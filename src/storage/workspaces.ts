export const WORKSPACE_LIMIT = 10;
export const WORKSPACE_NAME_LIMIT = 25;

import type { Anchor } from "../diffEngine/anchors";
import type { LineSegment } from "../file/lineNumbering";

export type WorkspaceAnchorState = {
  manualAnchors: Anchor[];
  autoAnchor: Anchor | null;
  suppressedAutoAnchorKey: string | null;
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  selectedAnchorKey: string | null;
};

export type WorkspaceCursor = {
  lineNumber: number;
  column: number;
};

export type WorkspacePaneState = {
  text: string;
  segments: LineSegment[];
  activeFile: string | null;
  cursor: WorkspaceCursor | null;
  scrollTop: number | null;
};

export type Workspace = {
  id: string;
  name: string;
  leftText: string;
  rightText: string;
  leftSegments?: LineSegment[];
  rightSegments?: LineSegment[];
  leftActiveFile?: string | null;
  rightActiveFile?: string | null;
  leftCursor?: WorkspaceCursor | null;
  rightCursor?: WorkspaceCursor | null;
  leftScrollTop?: number | null;
  rightScrollTop?: number | null;
  anchors: WorkspaceAnchorState;
};

export type WorkspacesState = {
  workspaces: Workspace[];
  selectedId: string;
};

export type WorkspaceError =
  | "empty"
  | "length"
  | "limit"
  | "not-found"
  | "last";

export type WorkspaceResult =
  | { ok: true; state: WorkspacesState }
  | { ok: false; reason: WorkspaceError; state: WorkspacesState };

const STORAGE_KEY = "diffViewer.workspaces";

function createWorkspaceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(raw: string): string {
  return raw.trim();
}

function isValidName(name: string): WorkspaceError | null {
  if (!name) {
    return "empty";
  }
  if (name.length > WORKSPACE_NAME_LIMIT) {
    return "length";
  }
  return null;
}

function normalizeAnchor(value: unknown): Anchor | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Anchor;
  if (
    typeof candidate.leftLineNo !== "number" ||
    !Number.isFinite(candidate.leftLineNo) ||
    typeof candidate.rightLineNo !== "number" ||
    !Number.isFinite(candidate.rightLineNo)
  ) {
    return null;
  }
  return { leftLineNo: candidate.leftLineNo, rightLineNo: candidate.rightLineNo };
}

function normalizeAnchorList(value: unknown): Anchor[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const anchors: Anchor[] = [];
  value.forEach((entry) => {
    const anchor = normalizeAnchor(entry);
    if (anchor) {
      anchors.push(anchor);
    }
  });
  return anchors;
}

function normalizeAnchorState(value: unknown): WorkspaceAnchorState {
  const record = value as Record<string, unknown> | null;
  const manualAnchors = normalizeAnchorList(record?.manualAnchors);
  const autoAnchor = normalizeAnchor(record?.autoAnchor);
  return {
    manualAnchors,
    autoAnchor,
    suppressedAutoAnchorKey:
      typeof record?.suppressedAutoAnchorKey === "string"
        ? record.suppressedAutoAnchorKey
        : null,
    pendingLeftLineNo:
      typeof record?.pendingLeftLineNo === "number" &&
      Number.isFinite(record.pendingLeftLineNo)
        ? record.pendingLeftLineNo
        : null,
    pendingRightLineNo:
      typeof record?.pendingRightLineNo === "number" &&
      Number.isFinite(record.pendingRightLineNo)
        ? record.pendingRightLineNo
        : null,
    selectedAnchorKey:
      typeof record?.selectedAnchorKey === "string" ? record.selectedAnchorKey : null,
  };
}

function normalizeSegments(value: unknown): LineSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const segments: LineSegment[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const record = entry as LineSegment;
    if (
      typeof record.startLine !== "number" ||
      !Number.isFinite(record.startLine) ||
      typeof record.lineCount !== "number" ||
      !Number.isFinite(record.lineCount) ||
      typeof record.fileIndex !== "number" ||
      !Number.isFinite(record.fileIndex)
    ) {
      return;
    }
    const fileName = typeof record.fileName === "string" ? record.fileName : undefined;
    const endsWithNewline =
      typeof record.endsWithNewline === "boolean" ? record.endsWithNewline : undefined;
    segments.push({
      startLine: record.startLine,
      lineCount: record.lineCount,
      fileIndex: record.fileIndex,
      fileName,
      endsWithNewline,
    });
  });
  return segments;
}

function normalizeCursor(value: unknown): WorkspaceCursor | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as WorkspaceCursor;
  if (
    typeof record.lineNumber !== "number" ||
    !Number.isFinite(record.lineNumber) ||
    typeof record.column !== "number" ||
    !Number.isFinite(record.column)
  ) {
    return null;
  }
  return {
    lineNumber: record.lineNumber,
    column: record.column,
  };
}

function normalizeScrollTop(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function ensureDefaultState(): WorkspacesState {
  const workspace: Workspace = {
    id: createWorkspaceId(),
    name: "Default",
    leftText: "",
    rightText: "",
    leftSegments: [],
    rightSegments: [],
    leftActiveFile: null,
    rightActiveFile: null,
    leftCursor: null,
    rightCursor: null,
    leftScrollTop: null,
    rightScrollTop: null,
    anchors: {
      manualAnchors: [],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: null,
    },
  };
  return { workspaces: [workspace], selectedId: workspace.id };
}

function normalizeState(raw: unknown): WorkspacesState {
  if (!raw || typeof raw !== "object") {
    return ensureDefaultState();
  }
  const data = raw as { workspaces?: unknown; selectedId?: unknown };
  if (!Array.isArray(data.workspaces)) {
    return ensureDefaultState();
  }
  const filtered = data.workspaces
    .filter(
      (item): item is Workspace =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Workspace).id === "string" &&
        typeof (item as Workspace).name === "string",
    )
    .map((item) => {
      const workspace = item as Workspace;
      const name = normalizeName(item.name);
      const error = isValidName(name);
      return {
        id: workspace.id,
        name: error ? "Workspace" : name,
        leftText: typeof workspace.leftText === "string" ? workspace.leftText : "",
        rightText: typeof workspace.rightText === "string" ? workspace.rightText : "",
        leftSegments: normalizeSegments(workspace.leftSegments),
        rightSegments: normalizeSegments(workspace.rightSegments),
        leftActiveFile:
          typeof workspace.leftActiveFile === "string" ? workspace.leftActiveFile : null,
        rightActiveFile:
          typeof workspace.rightActiveFile === "string" ? workspace.rightActiveFile : null,
        leftCursor: normalizeCursor(workspace.leftCursor),
        rightCursor: normalizeCursor(workspace.rightCursor),
        leftScrollTop: normalizeScrollTop(workspace.leftScrollTop),
        rightScrollTop: normalizeScrollTop(workspace.rightScrollTop),
        anchors: normalizeAnchorState(workspace.anchors),
      };
    })
    .slice(0, WORKSPACE_LIMIT);
  if (filtered.length === 0) {
    return ensureDefaultState();
  }
  const selectedId =
    typeof data.selectedId === "string" &&
    filtered.some((workspace) => workspace.id === data.selectedId)
      ? data.selectedId
      : filtered[0].id;
  return { workspaces: filtered, selectedId };
}

export function loadWorkspaces(storage: Storage | null): WorkspacesState {
  if (!storage) {
    return ensureDefaultState();
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      const fallback = ensureDefaultState();
      saveWorkspaces(storage, fallback);
      return fallback;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeState(parsed);
    saveWorkspaces(storage, normalized);
    return normalized;
  } catch (error) {
    console.warn("Failed to parse workspaces:", error);
    const fallback = ensureDefaultState();
    saveWorkspaces(storage, fallback);
    return fallback;
  }
}

export function saveWorkspaces(
  storage: Storage | null,
  state: WorkspacesState,
): void {
  if (!storage) {
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createWorkspace(
  storage: Storage | null,
  state: WorkspacesState,
  rawName: string,
): WorkspaceResult {
  if (state.workspaces.length >= WORKSPACE_LIMIT) {
    return { ok: false, reason: "limit", state };
  }
  const name = normalizeName(rawName);
  const error = isValidName(name);
  if (error) {
    return { ok: false, reason: error, state };
  }
  const nextWorkspace: Workspace = {
    id: createWorkspaceId(),
    name,
    leftText: "",
    rightText: "",
    leftSegments: [],
    rightSegments: [],
    leftActiveFile: null,
    rightActiveFile: null,
    leftCursor: null,
    rightCursor: null,
    leftScrollTop: null,
    rightScrollTop: null,
    anchors: {
      manualAnchors: [],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: null,
    },
  };
  const nextState: WorkspacesState = {
    workspaces: [...state.workspaces, nextWorkspace],
    selectedId: nextWorkspace.id,
  };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function renameWorkspace(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
  rawName: string,
): WorkspaceResult {
  const name = normalizeName(rawName);
  const error = isValidName(name);
  if (error) {
    return { ok: false, reason: error, state };
  }
  const index = state.workspaces.findIndex((workspace) => workspace.id === id);
  if (index === -1) {
    return { ok: false, reason: "not-found", state };
  }
  const nextWorkspaces = state.workspaces.map((workspace) =>
    workspace.id === id ? { ...workspace, name } : workspace,
  );
  const nextState: WorkspacesState = {
    workspaces: nextWorkspaces,
    selectedId: state.selectedId,
  };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function deleteWorkspace(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
): WorkspaceResult {
  if (state.workspaces.length <= 1) {
    return { ok: false, reason: "last", state };
  }
  const nextWorkspaces = state.workspaces.filter((workspace) => workspace.id !== id);
  if (nextWorkspaces.length === state.workspaces.length) {
    return { ok: false, reason: "not-found", state };
  }
  const selectedId =
    id === state.selectedId ? nextWorkspaces[0].id : state.selectedId;
  const nextState: WorkspacesState = { workspaces: nextWorkspaces, selectedId };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function selectWorkspace(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
): WorkspaceResult {
  if (!state.workspaces.some((workspace) => workspace.id === id)) {
    return { ok: false, reason: "not-found", state };
  }
  const nextState: WorkspacesState = { ...state, selectedId: id };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function reorderWorkspaces(
  storage: Storage | null,
  state: WorkspacesState,
  fromIndex: number,
  toIndex: number,
): WorkspaceResult {
  if (
    fromIndex < 0 ||
    fromIndex >= state.workspaces.length ||
    toIndex < 0 ||
    toIndex >= state.workspaces.length ||
    fromIndex === toIndex
  ) {
    return { ok: false, reason: "not-found", state };
  }
  const nextWorkspaces = [...state.workspaces];
  const [item] = nextWorkspaces.splice(fromIndex, 1);
  nextWorkspaces.splice(toIndex, 0, item);
  const nextState: WorkspacesState = {
    workspaces: nextWorkspaces,
    selectedId: state.selectedId,
  };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function setWorkspaceTexts(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
  leftText: string,
  rightText: string,
): WorkspaceResult {
  const index = state.workspaces.findIndex((workspace) => workspace.id === id);
  if (index === -1) {
    return { ok: false, reason: "not-found", state };
  }
  const nextWorkspaces = state.workspaces.map((workspace) =>
    workspace.id === id ? { ...workspace, leftText, rightText } : workspace,
  );
  const nextState: WorkspacesState = { ...state, workspaces: nextWorkspaces };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function setWorkspacePaneState(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
  pane: "left" | "right",
  snapshot: WorkspacePaneState,
): WorkspaceResult {
  const index = state.workspaces.findIndex((workspace) => workspace.id === id);
  if (index === -1) {
    return { ok: false, reason: "not-found", state };
  }
  const nextWorkspaces = state.workspaces.map((workspace) => {
    if (workspace.id !== id) {
      return workspace;
    }
    if (pane === "left") {
      return {
        ...workspace,
        leftText: snapshot.text,
        leftSegments: snapshot.segments.map((segment) => ({ ...segment })),
        leftActiveFile: snapshot.activeFile,
        leftCursor: snapshot.cursor ? { ...snapshot.cursor } : null,
        leftScrollTop: snapshot.scrollTop,
      };
    }
    return {
      ...workspace,
      rightText: snapshot.text,
      rightSegments: snapshot.segments.map((segment) => ({ ...segment })),
      rightActiveFile: snapshot.activeFile,
      rightCursor: snapshot.cursor ? { ...snapshot.cursor } : null,
      rightScrollTop: snapshot.scrollTop,
    };
  });
  const nextState: WorkspacesState = { ...state, workspaces: nextWorkspaces };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}

export function setWorkspaceAnchors(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
  anchors: WorkspaceAnchorState,
): WorkspaceResult {
  const index = state.workspaces.findIndex((workspace) => workspace.id === id);
  if (index === -1) {
    return { ok: false, reason: "not-found", state };
  }
  const nextWorkspaces = state.workspaces.map((workspace) =>
    workspace.id === id ? { ...workspace, anchors } : workspace,
  );
  const nextState: WorkspacesState = { ...state, workspaces: nextWorkspaces };
  saveWorkspaces(storage, nextState);
  return { ok: true, state: nextState };
}
