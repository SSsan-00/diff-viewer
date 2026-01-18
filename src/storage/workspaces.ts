export const WORKSPACE_LIMIT = 10;
export const WORKSPACE_NAME_LIMIT = 25;

export type Workspace = {
  id: string;
  name: string;
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

function ensureDefaultState(): WorkspacesState {
  const workspace: Workspace = { id: createWorkspaceId(), name: "Default" };
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
      const name = normalizeName(item.name);
      const error = isValidName(name);
      return {
        id: item.id,
        name: error ? "Workspace" : name,
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
  const nextWorkspace: Workspace = { id: createWorkspaceId(), name };
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
