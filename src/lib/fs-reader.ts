import { Project, SessionMeta, TokenUsage, Message, ContentBlock, ConversationData } from '@/types';
import {
  buildCodexMessages,
  codexMessageText,
  parseCodexSessionMeta,
} from '@/lib/codex-shared';

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0 };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreateTokens: a.cacheCreateTokens + b.cacheCreateTokens,
  };
}

function parseLines(content: string) {
  return content.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function parseSessionMeta(projectId: string, sessionId: string, content: string): SessionMeta {
  const lines = parseLines(content);

  let title = '';
  let cwd = '';
  let model = '';
  let startTime = '';
  let endTime = '';
  let messageCount = 0;
  let toolCallCount = 0;
  let tokenUsage = emptyUsage();

  for (const line of lines) {
    if (line.type === 'custom-title') {
      title = line.customTitle || '';
    }

    if (line.type === 'user') {
      if (!cwd && line.cwd) cwd = line.cwd;
      if (!startTime && line.timestamp) startTime = line.timestamp;
      if (line.timestamp) endTime = line.timestamp;

      const content = line.message?.content;
      if (typeof content === 'string' && content.trim()) {
        messageCount++;
      } else if (Array.isArray(content)) {
        if (content.some((c: { type: string }) => c.type === 'text')) messageCount++;
      }
    }

    if (line.type === 'assistant') {
      if (line.timestamp) endTime = line.timestamp;
      messageCount++;

      const usage = line.message?.usage;
      if (usage) {
        tokenUsage = addUsage(tokenUsage, {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          cacheCreateTokens: usage.cache_creation_input_tokens || 0,
        });
      }

      if (!model && line.message?.model && line.message.model !== '<synthetic>') {
        model = line.message.model;
      }

      const c = line.message?.content;
      if (Array.isArray(c)) {
        toolCallCount += c.filter((b: { type: string }) => b.type === 'tool_use').length;
      }
    }
  }

  if (!title) {
    const firstUser = lines.find(l => l.type === 'user');
    const rawContent = firstUser?.message?.content;
    if (typeof rawContent === 'string') {
      title = rawContent.slice(0, 60) + (rawContent.length > 60 ? '...' : '');
    } else if (Array.isArray(rawContent)) {
      const textBlock = rawContent.find((c: { type: string; text?: string }) => c.type === 'text');
      const text = textBlock?.text || '';
      title = text.slice(0, 60) + (text.length > 60 ? '...' : '');
    }
    if (!title) title = sessionId.slice(0, 8);
  }

  return { id: sessionId, provider: 'claude', projectId, title, startTime, endTime, messageCount, toolCallCount, tokenUsage, cwd, model };
}

// Cache parsed session metadata keyed by "<dir>/<file>", invalidated by the
// File's lastModified. getFile() is cheap; reading + parsing text() is not, so
// this lets polling getAllProjects() skip unchanged files.
const metaCache = new Map<string, { mtimeMs: number; meta: SessionMeta }>();

async function getSessionMetaCached(
  dirName: string,
  fileName: string,
  sessionId: string,
  file: File,
): Promise<SessionMeta> {
  const key = `${dirName}/${fileName}`;
  const hit = metaCache.get(key);
  if (hit && hit.mtimeMs === file.lastModified) return hit.meta;
  const meta = parseSessionMeta(dirName, sessionId, await file.text());
  metaCache.set(key, { mtimeMs: file.lastModified, meta });
  return meta;
}

export async function getAllProjects(dirHandle: FileSystemDirectoryHandle): Promise<Project[]> {
  const projects: Project[] = [];

  for await (const [dirName, projectHandle] of dirHandle.entries()) {
    if (projectHandle.kind !== 'directory') continue;

    const sessions: SessionMeta[] = [];

    for await (const [fileName, fileHandle] of (projectHandle as FileSystemDirectoryHandle).entries()) {
      if (fileHandle.kind !== 'file' || !fileName.endsWith('.jsonl')) continue;

      const file = await (fileHandle as FileSystemFileHandle).getFile();
      const sessionId = fileName.replace(/\.jsonl$/, '');
      sessions.push(await getSessionMetaCached(dirName, fileName, sessionId, file));
    }

    if (sessions.length === 0) continue;

    sessions.sort((a, b) => b.endTime.localeCompare(a.endTime));

    const cwd = sessions[0]?.cwd || dirName.replace(/^-/, '/').replace(/-/g, '/');
    const name = cwd ? cwd.split('/').filter(Boolean).pop() || dirName : dirName;
    const totalTokens = sessions.reduce((acc, s) => addUsage(acc, s.tokenUsage), emptyUsage());

    projects.push({ id: dirName, provider: 'claude', name, cwd, sessions, totalTokens });
  }

  return projects.sort((a, b) => {
    const aLatest = a.sessions[0]?.endTime || '';
    const bLatest = b.sessions[0]?.endTime || '';
    return bLatest.localeCompare(aLatest);
  });
}

export async function getSession(
  dirHandle: FileSystemDirectoryHandle,
  projectId: string,
  sessionId: string,
  since?: number,
): Promise<ConversationData | { unchanged: true } | null> {
  let projectHandle: FileSystemDirectoryHandle;
  try {
    projectHandle = await dirHandle.getDirectoryHandle(projectId);
  } catch {
    return null;
  }

  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await projectHandle.getFileHandle(`${sessionId}.jsonl`);
  } catch {
    return null;
  }

  const file = await fileHandle.getFile();
  const mtimeMs = file.lastModified;
  if (since != null && mtimeMs <= since) return { unchanged: true };

  const content = await file.text();
  const lines = parseLines(content);

  const sessionMeta = parseSessionMeta(projectId, sessionId, content);
  const messages: Message[] = [];

  for (const line of lines) {
    if (line.type !== 'user' && line.type !== 'assistant') continue;

    const rawContent = line.message?.content;
    let blocks: ContentBlock[] = [];

    if (typeof rawContent === 'string') {
      if (rawContent.trim()) blocks = [{ type: 'text', text: rawContent }];
    } else if (Array.isArray(rawContent)) {
      blocks = rawContent.map((c: Record<string, unknown>) => {
        if (c.type === 'text') return { type: 'text' as const, text: String(c.text || '') };
        if (c.type === 'thinking') return { type: 'thinking' as const, thinking: String(c.thinking || '') };
        if (c.type === 'redacted_thinking') return { type: 'thinking' as const, thinking: '' };
        if (c.type === 'tool_use') return {
          type: 'tool_use' as const,
          id: String(c.id || ''),
          name: String(c.name || ''),
          input: (c.input as Record<string, unknown>) || {},
        };
        if (c.type === 'tool_result') return {
          type: 'tool_result' as const,
          tool_use_id: String(c.tool_use_id || ''),
          content: c.content as string | ContentBlock[],
          isError: Boolean(c.is_error),
        };
        if (c.type === 'image') return {
          type: 'image' as const,
          source: (c.source as { type: string; url?: string; media_type?: string; data?: string }) || { type: 'base64' },
        };
        return { type: 'text' as const, text: JSON.stringify(c) };
      });
    }

    if (blocks.length === 0) continue;

    const usage = line.message?.usage;
    messages.push({
      uuid: line.uuid || '',
      parentUuid: line.parentUuid || null,
      type: line.type,
      timestamp: line.timestamp || '',
      content: blocks,
      isSidechain: line.isSidechain || false,
      usage: usage ? {
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        cacheCreateTokens: usage.cache_creation_input_tokens || 0,
      } : undefined,
    });
  }

  return { session: sessionMeta, messages, mtimeMs };
}

function extractMessageText(line: Record<string, unknown>): string {
  const rawContent = (line.message as Record<string, unknown>)?.content;
  if (typeof rawContent === 'string') return rawContent;
  if (Array.isArray(rawContent)) {
    return rawContent.map((c: Record<string, unknown>) => {
      if (c.type === 'text') return String(c.text || '');
      if (c.type === 'thinking') return String(c.thinking || '');
      return '';
    }).filter(Boolean).join(' ');
  }
  return '';
}

export interface SearchResult {
  session: SessionMeta;
  projectName: string;
  excerpt: string;
  messageUuid: string;
}

export async function searchSessions(
  dirHandle: FileSystemDirectoryHandle,
  query: string
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for await (const [dirName, projectHandle] of dirHandle.entries()) {
    if (projectHandle.kind !== 'directory') continue;

    for await (const [fileName, fileHandle] of (projectHandle as FileSystemDirectoryHandle).entries()) {
      if (fileHandle.kind !== 'file' || !fileName.endsWith('.jsonl')) continue;

      const file = await (fileHandle as FileSystemFileHandle).getFile();
      const content = await file.text();

      const sessionId = fileName.replace(/\.jsonl$/, '');
      const session = parseSessionMeta(dirName, sessionId, content);
      const cwd = session.cwd || dirName.replace(/^-/, '/').replace(/-/g, '/');
      const projectName = cwd ? cwd.split('/').filter(Boolean).pop() || dirName : dirName;

      const lines = content.split('\n').filter(Boolean);
      for (const rawLine of lines) {
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(rawLine); } catch { continue; }
        if (parsed.type !== 'user' && parsed.type !== 'assistant') continue;

        const text = extractMessageText(parsed);
        const idx = text.toLowerCase().indexOf(lowerQuery);
        if (idx === -1) continue;

        const uuid = String(parsed.uuid || '');
        const start = Math.max(0, idx - 80);
        const end = Math.min(text.length, idx + query.length + 80);
        const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');

        results.push({ session, projectName, excerpt, messageUuid: uuid });
        break;
      }

      if (results.length >= 50) return results;
    }
  }

  return results;
}

async function walkCodexJsonl(
  dirHandle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Array<{ id: string; handle: FileSystemFileHandle }>> {
  const files: Array<{ id: string; handle: FileSystemFileHandle }> = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const id = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      files.push(...await walkCodexJsonl(handle as FileSystemDirectoryHandle, id));
    } else if (handle.kind === 'file' && name.endsWith('.jsonl')) {
      files.push({ id, handle: handle as FileSystemFileHandle });
    }
  }
  return files;
}

async function getCodexFileHandleById(
  dirHandle: FileSystemDirectoryHandle,
  sessionId: string,
): Promise<FileSystemFileHandle | null> {
  const parts = sessionId.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some(part => part === '..' || part.includes('\\'))) return null;

  let current = dirHandle;
  for (const part of parts.slice(0, -1)) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }

  try {
    return await current.getFileHandle(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

const codexMetaCache = new Map<string, { mtimeMs: number; meta: SessionMeta }>();

async function getCodexSessionMetaCached(sessionId: string, file: File): Promise<SessionMeta> {
  const hit = codexMetaCache.get(sessionId);
  if (hit && hit.mtimeMs === file.lastModified) return hit.meta;
  const meta = parseCodexSessionMeta(sessionId, await file.text(), file.lastModified);
  codexMetaCache.set(sessionId, { mtimeMs: file.lastModified, meta });
  return meta;
}

export async function getCodexAllProjects(dirHandle: FileSystemDirectoryHandle): Promise<Project[]> {
  const sessionFiles = await walkCodexJsonl(dirHandle);
  const byProject = new Map<string, SessionMeta[]>();

  for (const sessionFile of sessionFiles) {
    const file = await sessionFile.handle.getFile();
    const session = await getCodexSessionMetaCached(sessionFile.id, file);
    const sessions = byProject.get(session.projectId) || [];
    sessions.push(session);
    byProject.set(session.projectId, sessions);
  }

  const projects: Project[] = [];
  for (const [projectId, sessions] of byProject) {
    sessions.sort((a, b) => b.endTime.localeCompare(a.endTime));
    const cwd = sessions[0]?.cwd || '';
    const name = cwd ? cwd.split('/').filter(Boolean).pop() || projectId : projectId;
    const totalTokens = sessions.reduce((acc, s) => addUsage(acc, s.tokenUsage), emptyUsage());
    projects.push({ id: projectId, provider: 'codex', name, cwd, sessions, totalTokens });
  }

  return projects.sort((a, b) => (b.sessions[0]?.endTime || '').localeCompare(a.sessions[0]?.endTime || ''));
}

export async function getCodexSession(
  dirHandle: FileSystemDirectoryHandle,
  projectId: string,
  sessionId: string,
  since?: number,
): Promise<ConversationData | { unchanged: true } | null> {
  const fileHandle = await getCodexFileHandleById(dirHandle, sessionId);
  if (!fileHandle) return null;

  const file = await fileHandle.getFile();
  const mtimeMs = file.lastModified;
  if (since != null && mtimeMs <= since) return { unchanged: true };

  const content = await file.text();
  const session = parseCodexSessionMeta(sessionId, content, mtimeMs);
  if (projectId && session.projectId !== projectId) return null;

  return { session, messages: buildCodexMessages(content, session.endTime), mtimeMs };
}

export async function searchCodexSessions(
  dirHandle: FileSystemDirectoryHandle,
  query: string,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const project of await getCodexAllProjects(dirHandle)) {
    for (const session of project.sessions) {
      const data = await getCodexSession(dirHandle, project.id, session.id);
      if (!data || 'unchanged' in data) continue;
      for (const message of data.messages) {
        const text = codexMessageText(message);
        const idx = text.toLowerCase().indexOf(lowerQuery);
        if (idx === -1) continue;
        const start = Math.max(0, idx - 80);
        const end = Math.min(text.length, idx + query.length + 80);
        const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
        results.push({ session, projectName: project.name, excerpt, messageUuid: message.uuid });
        break;
      }
      if (results.length >= 50) return results;
    }
  }

  return results;
}
