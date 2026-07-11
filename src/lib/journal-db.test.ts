import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import {
  deleteSessionAnnotation,
  getSessionAnnotation,
  listSessionAnnotations,
  saveSessionAnnotation,
} from './annotations';
import {
  ANNOTATIONS_STORE_NAME,
  HANDLES_STORE_NAME,
  JOURNAL_DB_NAME,
  openJournalDB,
  SEARCH_DOCUMENTS_SOURCE_PROVIDER_INDEX,
  SEARCH_DOCUMENTS_STORE_NAME,
} from './journal-db';
import { loadHandle } from './folder-store';

function createVersionOneDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(JOURNAL_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLES_STORE_NAME);
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(HANDLES_STORE_NAME, 'readwrite');
      transaction.objectStore(HANDLES_STORE_NAME).put({ name: 'legacy-handle' }, 'root');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function readValue(database: IDBDatabase, storeName: string, key: IDBValidKey) {
  return new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('journal database migration and annotations', () => {
  it('upgrades v1 without deleting the saved directory handle', async () => {
    await createVersionOneDatabase();

    const database = await openJournalDB();

    expect(database.objectStoreNames.contains(HANDLES_STORE_NAME)).toBe(true);
    expect(database.objectStoreNames.contains(ANNOTATIONS_STORE_NAME)).toBe(true);
    expect(database.objectStoreNames.contains(SEARCH_DOCUMENTS_STORE_NAME)).toBe(true);
    const searchStore = database
      .transaction(SEARCH_DOCUMENTS_STORE_NAME, 'readonly')
      .objectStore(SEARCH_DOCUMENTS_STORE_NAME);
    expect(searchStore.keyPath).toBe('sessionKey');
    expect(searchStore.indexNames.contains(SEARCH_DOCUMENTS_SOURCE_PROVIDER_INDEX)).toBe(true);
    expect(await readValue(database, HANDLES_STORE_NAME, 'root'))
      .toEqual({ name: 'legacy-handle' });

    const loaded = await loadHandle('claude');
    expect(loaded?.handle).toEqual({ name: 'legacy-handle' });
    expect(loaded?.sourceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await readValue(database, HANDLES_STORE_NAME, 'source-id:claude'))
      .toBe(loaded?.sourceId);
  });

  it('creates, partially updates, and deletes an annotation', async () => {
    let currentTime = 100;
    const now = vi.spyOn(Date, 'now');
    now.mockImplementation(() => currentTime);

    const created = await saveSessionAnnotation('session-key', {
      favorite: true,
      tags: [' Bug ', 'bug'],
    });
    currentTime = 200;
    const updated = await saveSessionAnnotation('session-key', { note: 'Remember this' });

    expect(created).toMatchObject({
      favorite: true,
      tags: ['Bug'],
      note: '',
      createdAt: 100,
      updatedAt: 100,
    });
    expect(updated).toMatchObject({
      favorite: true,
      tags: ['Bug'],
      note: 'Remember this',
      createdAt: 100,
      updatedAt: 200,
    });
    expect(await getSessionAnnotation('session-key')).toEqual(updated);
    expect(await listSessionAnnotations()).toContainEqual(updated);

    await deleteSessionAnnotation('session-key');
    expect(await getSessionAnnotation('session-key')).toBeNull();
    now.mockRestore();
  });
});
