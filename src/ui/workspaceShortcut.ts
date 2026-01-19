import type { WorkspacePanelController } from "./workspacePanel";

type WorkspaceShortcutContext = {
  panel: WorkspacePanelController;
};

function isWorkspaceShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  return event.key.toLowerCase() === "n" || event.code === "KeyN";
}

export function handleWorkspaceShortcut(
  event: KeyboardEvent,
  context: WorkspaceShortcutContext,
): boolean {
  if (!isWorkspaceShortcut(event)) {
    return false;
  }
  event.preventDefault();
  context.panel.toggle();
  return true;
}
