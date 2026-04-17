import type { Anchor } from "../diffEngine/anchors";
import type { FileEncoding } from "../file/decode";
import type { LineSegment } from "../file/lineNumbering";
import {
  createUnavailableTextStore,
  type TextStore,
} from "./textStore";

export const STORAGE_KEY = "diff-viewer:state";
export const STORAGE_VERSION = 1;
const INLINE_TEXT_FALLBACK_CHAR_LIMIT = 200_000;

export type PersistedState = {
  version: 1;
  leftText: string;
  rightText: string;
  leftEncoding: FileEncoding;
  rightEncoding: FileEncoding;
  scrollSync: boolean;
  foldEnabled: boolean;
  anchorPanelCollapsed: boolean;
  anchors: Anchor[];
  leftSegments: LineSegment[];
  rightSegments: LineSegment[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type TextStorageMode = "inline" | "indexeddb";
type SerializedPersistedState = PersistedState & {
  textStorage: TextStorageMode;
};

type PersistedStateOptions = {
  key?: string;
  textStore?: TextStore;
};

let saveQueue: Promise<void> = Promise.resolve();

function enqueueSave(task: () => Promise<void>): Promise<void> {
  const pending = saveQueue.then(task, task);
  saveQueue = pending.catch(() => undefined);
  return pending;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAnchors(value: unknown): Anchor[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const anchors: Anchor[] = [];
  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const leftLineNo = Number(entry.leftLineNo);
    const rightLineNo = Number(entry.rightLineNo);
    if (Number.isFinite(leftLineNo) && Number.isFinite(rightLineNo)) {
      anchors.push({ leftLineNo, rightLineNo });
    }
  });
  return anchors;
}

function normalizeSegments(value: unknown): LineSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const segments: LineSegment[] = [];
  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const startLine = Number(entry.startLine);
    const lineCount = Number(entry.lineCount);
    const fileIndex = Number(entry.fileIndex);
    if (
      !Number.isFinite(startLine) ||
      !Number.isFinite(lineCount) ||
      !Number.isFinite(fileIndex)
    ) {
      return;
    }
    const fileName = typeof entry.fileName === "string" ? entry.fileName : undefined;
    const endsWithNewline =
      typeof entry.endsWithNewline === "boolean" ? entry.endsWithNewline : undefined;
    segments.push({ startLine, lineCount, fileIndex, fileName, endsWithNewline });
  });
  return segments;
}

function normalizeEncoding(value: unknown, fallback: FileEncoding): FileEncoding {
  if (value === "auto" || value === "utf-8" || value === "shift_jis" || value === "euc-jp") {
    return value;
  }
  return fallback;
}

function normalizeTextStorageMode(value: unknown): TextStorageMode | null {
  return value === "inline" || value === "indexeddb" ? value : null;
}

function getTextStore(options?: PersistedStateOptions): TextStore {
  return options?.textStore ?? createUnavailableTextStore();
}

function getStateKey(options?: PersistedStateOptions): string {
  return options?.key ?? STORAGE_KEY;
}

function getPersistedTextKey(key: string, side: "left" | "right"): string {
  return `${key}:text:${side}`;
}

function serializePersistedState(
  state: PersistedState,
  includeInlineText: boolean,
  textStorage: TextStorageMode = includeInlineText ? "inline" : "indexeddb",
): SerializedPersistedState {
  return {
    ...state,
    leftText: includeInlineText ? state.leftText : "",
    rightText: includeInlineText ? state.rightText : "",
    textStorage,
  };
}

function shouldKeepInlineTextFallback(state: PersistedState): boolean {
  return state.leftText.length + state.rightText.length <= INLINE_TEXT_FALLBACK_CHAR_LIMIT;
}

async function writePersistedTexts(
  state: PersistedState,
  key: string,
  textStore: TextStore,
): Promise<void> {
  const leftKey = getPersistedTextKey(key, "left");
  const rightKey = getPersistedTextKey(key, "right");
  await Promise.all([
    state.leftText.length > 0
      ? textStore.set(leftKey, state.leftText)
      : textStore.delete(leftKey),
    state.rightText.length > 0
      ? textStore.set(rightKey, state.rightText)
      : textStore.delete(rightKey),
  ]);
}

async function readPersistedTexts(
  state: PersistedState,
  key: string,
  textStore: TextStore,
): Promise<PersistedState> {
  const [leftText, rightText] = await Promise.all([
    textStore.get(getPersistedTextKey(key, "left")),
    textStore.get(getPersistedTextKey(key, "right")),
  ]);
  return {
    ...state,
    leftText: leftText ?? state.leftText,
    rightText: rightText ?? state.rightText,
  };
}

async function persistSnapshot(
  storage: StorageLike | null,
  state: PersistedState,
  key: string,
  textStore: TextStore,
): Promise<void> {
  if (!storage) {
    return;
  }
  if (!textStore.isAvailable) {
    try {
      storage.setItem(key, JSON.stringify(serializePersistedState(state, true)));
    } catch (error) {
      console.warn("Failed to persist state:", error);
    }
    return;
  }
  try {
    await writePersistedTexts(state, key, textStore);
    storage.setItem(
      key,
      JSON.stringify(
        serializePersistedState(
          state,
          shouldKeepInlineTextFallback(state),
          "indexeddb",
        ),
      ),
    );
  } catch (error) {
    console.warn("Failed to persist state with IndexedDB:", error);
    try {
      storage.setItem(key, JSON.stringify(serializePersistedState(state, true)));
    } catch (storageError) {
      console.warn("Failed to persist state:", storageError);
    }
  }
}

export async function loadPersistedState(
  storage: StorageLike | null,
  options?: PersistedStateOptions,
): Promise<PersistedState | null> {
  const key = getStateKey(options);
  const textStore = getTextStore(options);
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) {
      return null;
    }
    const textStorageMode = normalizeTextStorageMode(parsed.textStorage);
    const state: PersistedState = {
      version: STORAGE_VERSION,
      leftText: toStringOrEmpty(parsed.leftText),
      rightText: toStringOrEmpty(parsed.rightText),
      leftEncoding: normalizeEncoding(parsed.leftEncoding, "auto"),
      rightEncoding: normalizeEncoding(parsed.rightEncoding, "auto"),
      scrollSync: toBoolean(parsed.scrollSync, true),
      foldEnabled: toBoolean(parsed.foldEnabled, false),
      anchorPanelCollapsed: toBoolean(parsed.anchorPanelCollapsed, false),
      anchors: normalizeAnchors(parsed.anchors),
      leftSegments: normalizeSegments(parsed.leftSegments),
      rightSegments: normalizeSegments(parsed.rightSegments),
    };
    if (!textStore.isAvailable) {
      return state;
    }
    const hasInlineText = state.leftText.length > 0 || state.rightText.length > 0;
    if (textStorageMode === "inline" || (textStorageMode === null && hasInlineText)) {
      await persistSnapshot(storage, state, key, textStore);
      return state;
    }
    let hydrated = state;
    let hydratedFromTextStore = false;
    try {
      hydrated = await readPersistedTexts(state, key, textStore);
      hydratedFromTextStore = true;
    } catch (error) {
      console.warn("Failed to hydrate persisted state from IndexedDB:", error);
    }
    if (hydratedFromTextStore && textStorageMode !== "indexeddb") {
      await persistSnapshot(storage, hydrated, key, textStore);
    }
    return hydrated;
  } catch (error) {
    console.warn("Failed to parse persisted state:", error);
    return null;
  }
}

export function savePersistedState(
  storage: StorageLike | null,
  state: PersistedState,
  options?: PersistedStateOptions,
): Promise<void> {
  const key = getStateKey(options);
  const textStore = getTextStore(options);
  if (!storage) {
    return Promise.resolve();
  }
  if (!textStore.isAvailable) {
    try {
      storage.setItem(key, JSON.stringify(serializePersistedState(state, true)));
    } catch (error) {
      console.warn("Failed to persist state:", error);
    }
    return Promise.resolve();
  }
  return enqueueSave(() => persistSnapshot(storage, state, key, textStore));
}

export function saveInlinePersistedStateSnapshot(
  storage: StorageLike | null,
  state: PersistedState,
  options?: PersistedStateOptions,
): void {
  const key = getStateKey(options);
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(serializePersistedState(state, true, "inline")));
  } catch (error) {
    console.warn("Failed to persist state:", error);
  }
}

export function clearPersistedState(
  storage: StorageLike | null,
  options?: PersistedStateOptions,
): Promise<void> {
  const key = getStateKey(options);
  const textStore = getTextStore(options);
  if (!storage) {
    return Promise.resolve();
  }
  const clearLocalStorage = () => {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn("Failed to clear persisted state:", error);
    }
  };
  if (!textStore.isAvailable) {
    clearLocalStorage();
    return Promise.resolve();
  }
  return enqueueSave(async () => {
    try {
      await Promise.all([
        textStore.delete(getPersistedTextKey(key, "left")),
        textStore.delete(getPersistedTextKey(key, "right")),
      ]);
    } catch (error) {
      console.warn("Failed to clear persisted state from IndexedDB:", error);
    }
    clearLocalStorage();
  });
}

type PersistSchedulerOptions = {
  storage: StorageLike | null;
  getState: () => PersistedState;
  key?: string;
  delayMs?: number;
  textStore?: TextStore;
};

export function createPersistScheduler(options: PersistSchedulerOptions): {
  schedule: () => void;
  flush: () => void;
  cancel: () => void;
} {
  const {
    storage,
    getState,
    key = STORAGE_KEY,
    delayMs = 200,
    textStore,
  } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const saveNow = () =>
    savePersistedState(storage, getState(), {
      key,
      textStore,
    });

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void saveNow();
    }, delayMs);
  };

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void saveNow();
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { schedule, flush, cancel };
}
