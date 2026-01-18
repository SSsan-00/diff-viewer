import { deleteWorkspace, type WorkspacesState } from "../storage/workspaces";

export type WorkspaceRemovalResult =
  | { ok: true; state: WorkspacesState }
  | {
      ok: false;
      reason: "cancelled" | "last" | "not-found";
      state: WorkspacesState;
    };

export function removeWorkspaceWithConfirm(
  storage: Storage | null,
  state: WorkspacesState,
  id: string,
  confirm: (message: string) => boolean,
): WorkspaceRemovalResult {
  const target = state.workspaces.find((workspace) => workspace.id === id);
  if (!target) {
    return { ok: false, reason: "not-found", state };
  }
  const message = `ワークスペース「${target.name}」を削除します。よろしいですか？`;
  if (!confirm(message)) {
    return { ok: false, reason: "cancelled", state };
  }
  const result = deleteWorkspace(storage, state, id);
  if (result.ok) {
    return { ok: true, state: result.state };
  }
  return { ok: false, reason: result.reason, state: result.state };
}
