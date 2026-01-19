import type { Workspace, WorkspaceAnchorState, WorkspacesState } from "../storage/workspaces";
import { applyWorkspaceSwitchWithAnchors } from "./workspaceContent";

type EditorAdapter = {
  getValue: () => string;
  setValue: (value: string) => void;
};

type WorkspaceEditors = {
  left: EditorAdapter;
  right: EditorAdapter;
};

type WorkspaceSwitchHooks = {
  onAfterRestore?: (nextState: WorkspacesState, target: Workspace) => void;
  onAfterSwitch?: (nextState: WorkspacesState, target: Workspace) => void;
};

export function runWorkspaceSwitch(
  state: WorkspacesState,
  nextId: string,
  editors: WorkspaceEditors,
  currentAnchors: WorkspaceAnchorState,
  hooks?: WorkspaceSwitchHooks,
): WorkspacesState {
  let restoredTarget: Workspace | null = null;
  const nextState = applyWorkspaceSwitchWithAnchors(
    state,
    nextId,
    editors,
    currentAnchors,
    {
      onAfterRestore: (stateAfter, target) => {
        restoredTarget = target;
        hooks?.onAfterRestore?.(stateAfter, target);
      },
    },
  );
  if (nextState.selectedId === state.selectedId) {
    return state;
  }
  const target =
    restoredTarget ??
    nextState.workspaces.find((workspace) => workspace.id === nextState.selectedId) ??
    nextState.workspaces[0];
  if (target) {
    hooks?.onAfterSwitch?.(nextState, target);
  }
  return nextState;
}
