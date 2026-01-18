import type { WorkspacesState } from "../storage/workspaces";

export function getWorkspaceTitle(state: WorkspacesState): string {
  const current =
    state.workspaces.find((workspace) => workspace.id === state.selectedId) ??
    state.workspaces[0];
  return current ? current.name : "Workspace";
}
