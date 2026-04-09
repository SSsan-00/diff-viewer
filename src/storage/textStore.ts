export type TextStore = {
  isAvailable: boolean;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

const DB_NAME = "diff-viewer";
const STORE_NAME = "texts";

const unavailableTextStore: TextStore = {
  isAvailable: false,
  get: async () => null,
  set: async () => undefined,
  delete: async () => undefined,
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

export function createIndexedDbTextStore(
  indexedDb: IDBFactory | undefined = globalThis.indexedDB,
): TextStore {
  if (!indexedDb) {
    return unavailableTextStore;
  }

  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDb.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Failed to open IndexedDB."));
      });
    }
    return dbPromise;
  };

  return {
    isAvailable: true,
    async get(key: string): Promise<string | null> {
      const database = await getDb();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const result = await requestToPromise(store.get(key));
      await transactionDone(transaction);
      return typeof result === "string" ? result : null;
    },
    async set(key: string, value: string): Promise<void> {
      const database = await getDb();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      await transactionDone(transaction);
    },
    async delete(key: string): Promise<void> {
      const database = await getDb();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      await transactionDone(transaction);
    },
  };
}

export function createUnavailableTextStore(): TextStore {
  return unavailableTextStore;
}
