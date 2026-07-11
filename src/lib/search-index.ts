import type {
  ContentBlock,
  ConversationData,
  Project,
  Provider,
  SessionMeta,
} from '@/types';
import { makeSessionKey } from '@/lib/annotations';
import {
  openJournalDB,
  SEARCH_DOCUMENTS_SOURCE_PROVIDER_INDEX,
  SEARCH_DOCUMENTS_STORE_NAME,
} from '@/lib/journal-db';

const MAX_SEARCH_RESULTS = 50;
const EXCERPT_CONTEXT_LENGTH = 80;

export interface SearchMessageDocument {
  messageUuid: string;
  text: string;
}

export interface SearchDocument {
  sessionKey: string;
  sourceId: string;
  provider: Provider;
  projectId: string;
  sessionId: string;
  signature: string;
  projectName: string;
  session: SessionMeta;
  messages: SearchMessageDocument[];
}

export interface SearchResult {
  session: SessionMeta;
  projectName: string;
  excerpt: string;
  messageUuid: string;
}

export type SearchSessionLoader = (
  projectId: string,
  sessionId: string,
) => Promise<ConversationData | { unchanged: true } | null>;

export interface UpdateSearchIndexOptions {
  sourceId: string;
  provider: Provider;
  projects: readonly Project[];
  loadSession: SearchSessionLoader;
  /** Lets callers abandon work when the selected folder or provider changes. */
  isCurrent?: () => boolean;
}

export interface SearchIndexUpdate {
  rebuilt: number;
  deleted: number;
  cancelled: boolean;
}

/** Metadata-only signature used to avoid reopening unchanged session files. */
export function sessionSearchSignature(session: SessionMeta): string {
  return JSON.stringify([
    session.endTime,
    session.messageCount,
    session.toolCallCount,
    session.title,
  ]);
}

function serializeToolInput(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function blockSearchText(block: ContentBlock): string {
  if (block.type === 'text') return block.text;
  if (block.type === 'thinking') return block.thinking;
  if (block.type === 'tool_use') return `${block.name} ${serializeToolInput(block.input)}`;
  if (block.type === 'tool_result') {
    if (typeof block.content === 'string') return block.content;
    return block.content.map(blockSearchText).filter(Boolean).join('\n');
  }
  return '';
}

function buildSearchMessages(data: ConversationData): SearchMessageDocument[] {
  return data.messages.map(message => ({
    messageUuid: message.uuid,
    text: message.content.map(blockSearchText).filter(Boolean).join('\n'),
  })).filter(message => message.text.length > 0);
}

function getDocumentsForSource(
  sourceId: string,
  provider: Provider,
): Promise<SearchDocument[]> {
  return openJournalDB().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(SEARCH_DOCUMENTS_STORE_NAME, 'readonly');
    const index = transaction.objectStore(SEARCH_DOCUMENTS_STORE_NAME)
      .index(SEARCH_DOCUMENTS_SOURCE_PROVIDER_INDEX);
    const request = index.getAll(IDBKeyRange.only([sourceId, provider]));

    request.onsuccess = () => resolve(request.result as SearchDocument[]);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Search index read was aborted'));
  }));
}

function writeSearchIndexChanges(
  documents: readonly SearchDocument[],
  deletedKeys: readonly string[],
): Promise<void> {
  if (documents.length === 0 && deletedKeys.length === 0) return Promise.resolve();

  return openJournalDB().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(SEARCH_DOCUMENTS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SEARCH_DOCUMENTS_STORE_NAME);

    for (const key of deletedKeys) store.delete(key);
    for (const document of documents) store.put(document);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Search index update was aborted'));
  }));
}

/**
 * Build an index on first use, then incrementally rebuild only changed sessions.
 * Documents deleted from the current source/provider are removed in the same
 * transaction as the updated documents.
 */
export async function updateSearchIndex({
  sourceId,
  provider,
  projects,
  loadSession,
  isCurrent = () => true,
}: UpdateSearchIndexOptions): Promise<SearchIndexUpdate> {
  if (!isCurrent()) return { rebuilt: 0, deleted: 0, cancelled: true };

  const existingDocuments = await getDocumentsForSource(sourceId, provider);
  if (!isCurrent()) return { rebuilt: 0, deleted: 0, cancelled: true };

  const existingByKey = new Map(existingDocuments.map(document => [document.sessionKey, document]));
  const currentKeys = new Set<string>();
  const rebuiltDocuments: SearchDocument[] = [];

  for (const project of projects) {
    for (const session of project.sessions) {
      if (!isCurrent()) return { rebuilt: 0, deleted: 0, cancelled: true };

      const sessionKey = makeSessionKey(sourceId, provider, project.id, session.id);
      const signature = sessionSearchSignature(session);
      currentKeys.add(sessionKey);

      if (existingByKey.get(sessionKey)?.signature === signature) continue;

      const data = await loadSession(project.id, session.id);
      if (!isCurrent()) return { rebuilt: 0, deleted: 0, cancelled: true };
      if (!data || 'unchanged' in data) continue;

      rebuiltDocuments.push({
        sessionKey,
        sourceId,
        provider,
        projectId: project.id,
        sessionId: session.id,
        signature,
        projectName: project.name,
        session: data.session,
        messages: buildSearchMessages(data),
      });
    }
  }

  const deletedKeys = existingDocuments
    .filter(document => !currentKeys.has(document.sessionKey))
    .map(document => document.sessionKey);

  if (!isCurrent()) return { rebuilt: 0, deleted: 0, cancelled: true };
  await writeSearchIndexChanges(rebuiltDocuments, deletedKeys);

  return {
    rebuilt: rebuiltDocuments.length,
    deleted: deletedKeys.length,
    cancelled: false,
  };
}

function excerptFor(text: string, query: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - EXCERPT_CONTEXT_LENGTH);
  const end = Math.min(text.length, matchIndex + query.length + EXCERPT_CONTEXT_LENGTH);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

/** Query the persisted index, returning at most one match per recent session. */
export async function querySearchIndex(
  sourceId: string,
  provider: Provider,
  query: string,
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  const documents = await getDocumentsForSource(sourceId, provider);
  documents.sort((a, b) => {
    const byEndTime = b.session.endTime.localeCompare(a.session.endTime);
    return byEndTime || a.sessionKey.localeCompare(b.sessionKey);
  });

  const results: SearchResult[] = [];
  for (const document of documents) {
    for (const message of document.messages) {
      const matchIndex = message.text.toLocaleLowerCase().indexOf(lowerQuery);
      if (matchIndex === -1) continue;

      results.push({
        session: document.session,
        projectName: document.projectName,
        excerpt: excerptFor(message.text, normalizedQuery, matchIndex),
        messageUuid: message.messageUuid,
      });
      break;
    }
    if (results.length >= MAX_SEARCH_RESULTS) break;
  }

  return results;
}
