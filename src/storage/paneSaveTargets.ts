import type { PaneSaveTarget } from "../file/writeback";

export type PaneSide = "left" | "right";

export type PaneSaveTargetStore = {
  isAvailable: boolean;
  get: (key: string) => Promise<PaneSaveTarget | null>;
  set: (key: string, value: PaneSaveTarget) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

const DB_NAME = "diff-viewer-pane-save-targets";
const STORE_NAME = "targets";

const unavailablePaneSaveTargetStore: PaneSaveTargetStore = {
  isAvailable: false,
  get: async () => null,
  set: async () => undefined,
  delete: async () => undefined,
};

function getPaneSaveTargetKey(workspaceId: string, side: PaneSide): string {
  return `${workspaceId}:${side}`;
}

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

export function createIndexedDbPaneSaveTargetStore(
  indexedDb: IDBFactory | undefined = globalThis.indexedDB,
): PaneSaveTargetStore {
  if (!indexedDb) {
    return unavailablePaneSaveTargetStore;
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
    async get(key: string): Promise<PaneSaveTarget | null> {
      const database = await getDb();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const result = await requestToPromise(store.get(key));
      await transactionDone(transaction);
      return result && typeof result === "object" ? result as PaneSaveTarget : null;
    },
    async set(key: string, value: PaneSaveTarget): Promise<void> {
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

export function createUnavailablePaneSaveTargetStore(): PaneSaveTargetStore {
  return unavailablePaneSaveTargetStore;
}

export function loadPaneSaveTarget(
  store: PaneSaveTargetStore,
  workspaceId: string,
  side: PaneSide,
): Promise<PaneSaveTarget | null> {
  if (!store.isAvailable) {
    return Promise.resolve(null);
  }
  return store.get(getPaneSaveTargetKey(workspaceId, side));
}

export function savePaneSaveTarget(
  store: PaneSaveTargetStore,
  workspaceId: string,
  side: PaneSide,
  target: PaneSaveTarget,
): Promise<void> {
  if (!store.isAvailable) {
    return Promise.resolve();
  }
  return store.set(getPaneSaveTargetKey(workspaceId, side), target);
}

export function clearPaneSaveTarget(
  store: PaneSaveTargetStore,
  workspaceId: string,
  side: PaneSide,
): Promise<void> {
  if (!store.isAvailable) {
    return Promise.resolve();
  }
  return store.delete(getPaneSaveTargetKey(workspaceId, side));
}
