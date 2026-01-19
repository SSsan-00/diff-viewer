import type {
  Workspace,
  WorkspaceAnchorState,
  WorkspacesState,
} from "../storage/workspaces";

type EditorAdapter = {
  getValue: () => string;
  setValue: (value: string) => void;
};

type WorkspaceEditors = {
  left: EditorAdapter;
  right: EditorAdapter;
};

export function applyWorkspaceSwitch(
  state: WorkspacesState,
  nextId: string,
  editors: WorkspaceEditors,
): WorkspacesState {
  if (state.workspaces.length === 0) {
    return state;
  }
  const currentId = state.selectedId;
  const leftText = editors.left.getValue();
  const rightText = editors.right.getValue();
  const nextWorkspaces = state.workspaces.map((workspace) =>
    workspace.id === currentId ? { ...workspace, leftText, rightText } : workspace,
  );
  const savedState: WorkspacesState = { ...state, workspaces: nextWorkspaces };
  const target =
    savedState.workspaces.find((workspace) => workspace.id === nextId) ??
    savedState.workspaces.find((workspace) => workspace.id === savedState.selectedId) ??
    savedState.workspaces[0];
  if (!target) {
    return savedState;
  }
  editors.left.setValue(target.leftText);
  editors.right.setValue(target.rightText);
  return { ...savedState, selectedId: target.id };
}

export function applyWorkspaceSwitchWithHooks(
  state: WorkspacesState,
  nextId: string,
  editors: WorkspaceEditors,
  hooks?: { onAfterRestore?: (nextState: WorkspacesState) => void },
): WorkspacesState {
  const nextState = applyWorkspaceSwitch(state, nextId, editors);
  if (nextState.selectedId !== state.selectedId) {
    hooks?.onAfterRestore?.(nextState);
  }
  return nextState;
}

export function applyWorkspaceSwitchWithAnchors(
  state: WorkspacesState,
  nextId: string,
  editors: WorkspaceEditors,
  currentAnchors: WorkspaceAnchorState,
  hooks?: { onAfterRestore?: (nextState: WorkspacesState, target: Workspace) => void },
): WorkspacesState {
  if (state.workspaces.length === 0) {
    return state;
  }
  const currentId = state.selectedId;
  const leftText = editors.left.getValue();
  const rightText = editors.right.getValue();
  const nextWorkspaces = state.workspaces.map((workspace) =>
    workspace.id === currentId
      ? { ...workspace, leftText, rightText, anchors: currentAnchors }
      : workspace,
  );
  const savedState: WorkspacesState = { ...state, workspaces: nextWorkspaces };
  const target =
    savedState.workspaces.find((workspace) => workspace.id === nextId) ??
    savedState.workspaces.find((workspace) => workspace.id === savedState.selectedId) ??
    savedState.workspaces[0];
  if (!target) {
    return savedState;
  }
  editors.left.setValue(target.leftText);
  editors.right.setValue(target.rightText);
  const nextState = { ...savedState, selectedId: target.id };
  hooks?.onAfterRestore?.(nextState, target);
  return nextState;
}
