import type { Anchor } from "../diffEngine/anchors";
import type { FileEncoding } from "../file/decode";
import type { LineSegment } from "../file/lineNumbering";

export const STORAGE_KEY = "diff-viewer:state";
export const STORAGE_VERSION = 1;

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

export function loadPersistedState(
  storage: StorageLike | null,
  key = STORAGE_KEY,
): PersistedState | null {
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
    const leftEncoding = normalizeEncoding(parsed.leftEncoding, "auto");
    const rightEncoding = normalizeEncoding(parsed.rightEncoding, "auto");
    return {
      version: STORAGE_VERSION,
      leftText: toStringOrEmpty(parsed.leftText),
      rightText: toStringOrEmpty(parsed.rightText),
      leftEncoding,
      rightEncoding,
      scrollSync: toBoolean(parsed.scrollSync, true),
      foldEnabled: toBoolean(parsed.foldEnabled, false),
      anchorPanelCollapsed: toBoolean(parsed.anchorPanelCollapsed, false),
      anchors: normalizeAnchors(parsed.anchors),
      leftSegments: normalizeSegments(parsed.leftSegments),
      rightSegments: normalizeSegments(parsed.rightSegments),
    };
  } catch (error) {
    console.warn("Failed to parse persisted state:", error);
    return null;
  }
}

export function savePersistedState(
  storage: StorageLike | null,
  state: PersistedState,
  key = STORAGE_KEY,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist state:", error);
  }
}

export function clearPersistedState(
  storage: StorageLike | null,
  key = STORAGE_KEY,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch (error) {
    console.warn("Failed to clear persisted state:", error);
  }
}

type PersistSchedulerOptions = {
  storage: StorageLike | null;
  getState: () => PersistedState;
  key?: string;
  delayMs?: number;
};

export function createPersistScheduler(options: PersistSchedulerOptions): {
  schedule: () => void;
  flush: () => void;
  cancel: () => void;
} {
  const { storage, getState, key = STORAGE_KEY, delayMs = 200 } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const saveNow = () => {
    savePersistedState(storage, getState(), key);
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      saveNow();
    }, delayMs);
  };

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    saveNow();
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { schedule, flush, cancel };
}
