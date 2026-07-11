import type { Provider } from '@/types';
import { HANDLES_STORE_NAME, openJournalDB } from '@/lib/journal-db';

const LEGACY_HANDLE_KEY = 'root';
export const LOCAL_SOURCE_ID = 'local-filesystem';

export interface StoredFolderSource {
  handle: FileSystemDirectoryHandle;
  sourceId: string;
}

export interface SourceIdCrypto {
  randomUUID?: () => string;
  getRandomValues: (bytes: Uint8Array) => Uint8Array;
}

function handleKey(provider: Provider): string {
  return `root:${provider}`;
}

function sourceIdKey(provider: Provider): string {
  return `source-id:${provider}`;
}

/** Generate a UUID using Web Crypto, including browsers without randomUUID(). */
export function generateSourceId(cryptoApi?: SourceIdCrypto): string {
  const sourceCrypto = cryptoApi ?? (() => {
    if (typeof globalThis.crypto === 'undefined'
      || typeof globalThis.crypto.getRandomValues !== 'function') {
      throw new Error('A secure random source is required to identify this folder');
    }

    return {
      randomUUID: typeof globalThis.crypto.randomUUID === 'function'
        ? () => globalThis.crypto.randomUUID()
        : undefined,
      getRandomValues: (bytes: Uint8Array) => globalThis.crypto.getRandomValues(bytes),
    };
  })();

  if (sourceCrypto.randomUUID) {
    try {
      return sourceCrypto.randomUUID();
    } catch {
      // Some older Web Crypto implementations expose but do not implement it.
    }
  }

  const bytes = sourceCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/** Saving a selected folder starts a new source identity for that provider. */
export async function saveHandle(
  handle: FileSystemDirectoryHandle,
  provider: Provider,
  sourceId = generateSourceId(),
): Promise<string> {
  const db = await openJournalDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE_NAME);
    store.put(handle, handleKey(provider));
    store.put(sourceId, sourceIdKey(provider));
    tx.oncomplete = () => resolve(sourceId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Saving the folder was aborted'));
  });
}

/** Load a folder and its stable identity, backfilling IDs saved by older versions. */
export async function loadHandle(provider: Provider): Promise<StoredFolderSource | null> {
  try {
    const db = await openJournalDB();
    return await new Promise<StoredFolderSource | null>((resolve, reject) => {
      const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLES_STORE_NAME);
      const handleRequest = store.get(handleKey(provider));
      const legacyRequest = provider === 'claude' ? store.get(LEGACY_HANDLE_KEY) : null;
      const sourceIdRequest = store.get(sourceIdKey(provider));
      let requestsRemaining = legacyRequest ? 3 : 2;
      let result: StoredFolderSource | null = null;

      const finishRequest = () => {
        requestsRemaining -= 1;
        if (requestsRemaining !== 0) return;

        const handle = (handleRequest.result ?? legacyRequest?.result ?? null) as
          FileSystemDirectoryHandle | null;
        if (!handle) return;

        const storedSourceId = sourceIdRequest.result;
        const sourceId = typeof storedSourceId === 'string' && storedSourceId
          ? storedSourceId
          : generateSourceId();

        if (sourceId !== storedSourceId) {
          store.put(sourceId, sourceIdKey(provider));
        }
        result = { handle, sourceId };
      };

      handleRequest.onsuccess = finishRequest;
      sourceIdRequest.onsuccess = finishRequest;
      if (legacyRequest) legacyRequest.onsuccess = finishRequest;

      const rejectRequest = (event: Event) => {
        const request = event.target as IDBRequest;
        reject(request.error ?? new Error('Loading the saved folder failed'));
      };
      handleRequest.onerror = rejectRequest;
      sourceIdRequest.onerror = rejectRequest;
      if (legacyRequest) legacyRequest.onerror = rejectRequest;

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Loading the saved folder was aborted'));
    });
  } catch {
    return null;
  }
}

export async function clearHandle(provider: Provider): Promise<void> {
  const db = await openJournalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE_NAME);
    store.delete(handleKey(provider));
    store.delete(sourceIdKey(provider));
    if (provider === 'claude') store.delete(LEGACY_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Clearing the saved folder was aborted'));
  });
}
