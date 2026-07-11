export const JOURNAL_DB_NAME = 'claude-journal';
export const JOURNAL_DB_VERSION = 3;

export const HANDLES_STORE_NAME = 'handles';
export const ANNOTATIONS_STORE_NAME = 'annotations';
export const SEARCH_DOCUMENTS_STORE_NAME = 'searchDocuments';
export const SEARCH_DOCUMENTS_SOURCE_PROVIDER_INDEX = 'bySourceAndProvider';

let databasePromise: Promise<IDBDatabase> | null = null;

function createDatabaseConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(JOURNAL_DB_NAME, JOURNAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      // A fresh install needs every store. On upgrades, existing stores are
      // left untouched so saved handles and annotations are not lost.
      if (!database.objectStoreNames.contains(HANDLES_STORE_NAME)) {
        database.createObjectStore(HANDLES_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(ANNOTATIONS_STORE_NAME)) {
        database.createObjectStore(ANNOTATIONS_STORE_NAME, { keyPath: 'sessionKey' });
      }
      if (!database.objectStoreNames.contains(SEARCH_DOCUMENTS_STORE_NAME)) {
        const searchDocuments = database.createObjectStore(SEARCH_DOCUMENTS_STORE_NAME, {
          keyPath: 'sessionKey',
        });
        searchDocuments.createIndex(
          SEARCH_DOCUMENTS_SOURCE_PROVIDER_INDEX,
          ['sourceId', 'provider'],
          { unique: false },
        );
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
  });
}

/** Open the shared local database, upgrading older versions without deleting data. */
export function openJournalDB(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = createDatabaseConnection().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}
