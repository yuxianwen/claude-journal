import type { Provider } from '@/types';
import { ANNOTATIONS_STORE_NAME, openJournalDB } from '@/lib/journal-db';

export const ANNOTATIONS_CHANGE_EVENT = 'ai-journal-annotations-change';

function notifyAnnotationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ANNOTATIONS_CHANGE_EVENT));
}

export interface SessionAnnotation {
  sessionKey: string;
  favorite: boolean;
  tags: string[];
  note: string;
  createdAt: number;
  updatedAt: number;
}

export type SessionAnnotationChanges = Partial<
  Pick<SessionAnnotation, 'favorite' | 'tags' | 'note'>
>;

/**
 * Trim tags, remove blank entries, and de-duplicate case-insensitively while
 * retaining the spelling of the first occurrence.
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const displayTag = tag.trim();
    if (!displayTag) continue;

    const comparisonKey = displayTag.toLowerCase();
    if (seen.has(comparisonKey)) continue;

    seen.add(comparisonKey);
    normalized.push(displayTag);
  }

  return normalized;
}

/** Build a collision-safe identity for a session across sources and providers. */
export function makeSessionKey(
  sourceId: string,
  provider: Provider,
  projectId: string,
  sessionId: string,
): string {
  return `v1:${[sourceId, provider, projectId, sessionId].map(encodeURIComponent).join(':')}`;
}

export async function getSessionAnnotation(sessionKey: string): Promise<SessionAnnotation | null> {
  const database = await openJournalDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ANNOTATIONS_STORE_NAME, 'readonly');
    const request = transaction.objectStore(ANNOTATIONS_STORE_NAME).get(sessionKey);

    request.onsuccess = () => resolve((request.result as SessionAnnotation | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function listSessionAnnotations(): Promise<SessionAnnotation[]> {
  const database = await openJournalDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ANNOTATIONS_STORE_NAME, 'readonly');
    const request = transaction.objectStore(ANNOTATIONS_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as SessionAnnotation[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

/** Save a partial annotation, preserving its original creation timestamp. */
export async function saveSessionAnnotation(
  sessionKey: string,
  changes: SessionAnnotationChanges,
): Promise<SessionAnnotation> {
  const database = await openJournalDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ANNOTATIONS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(ANNOTATIONS_STORE_NAME);
    const getRequest = store.get(sessionKey);
    let annotation: SessionAnnotation | null = null;

    getRequest.onsuccess = () => {
      const existing = (getRequest.result as SessionAnnotation | undefined) ?? null;
      const now = Date.now();

      annotation = {
        sessionKey,
        favorite: changes.favorite ?? existing?.favorite ?? false,
        tags: changes.tags === undefined
          ? (existing?.tags ?? [])
          : normalizeTags(changes.tags),
        note: changes.note ?? existing?.note ?? '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      store.put(annotation);
    };
    getRequest.onerror = () => reject(getRequest.error);
    transaction.oncomplete = () => {
      if (annotation) {
        notifyAnnotationsChanged();
        resolve(annotation);
      }
      else reject(new Error('Annotation transaction completed without saving'));
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Annotation save was aborted'));
  });
}

export async function deleteSessionAnnotation(sessionKey: string): Promise<void> {
  const database = await openJournalDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ANNOTATIONS_STORE_NAME, 'readwrite');
    transaction.objectStore(ANNOTATIONS_STORE_NAME).delete(sessionKey);

    transaction.oncomplete = () => {
      notifyAnnotationsChanged();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Annotation delete was aborted'));
  });
}
