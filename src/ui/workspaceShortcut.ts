import type { WorkspacePanelController } from "./workspacePanel";

type WorkspaceShortcutContext = {
  panel: WorkspacePanelController;
};

function isWorkspaceShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey || event.metaKey || event.altKey) {
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
