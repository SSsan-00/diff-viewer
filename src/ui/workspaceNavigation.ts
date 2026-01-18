import type { Workspace } from "../storage/workspaces";

export function resolveWorkspaceMoveDelta(event: KeyboardEvent): number | null {
  if (event.key === "ArrowUp") {
    return -1;
  }
  if (event.key === "ArrowDown") {
    return 1;
  }
  return null;
}

export function getNextWorkspaceId(
  workspaces: readonly Workspace[],
  selectedId: string,
  delta: number,
): string | null {
  if (workspaces.length === 0) {
    return null;
  }
  const currentIndex = workspaces.findIndex(
    (workspace) => workspace.id === selectedId,
  );
  const startIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = Math.min(
    Math.max(startIndex + delta, 0),
    workspaces.length - 1,
  );
  return workspaces[nextIndex]?.id ?? null;
}

export function handleWorkspaceNavigation(
  event: KeyboardEvent,
  options: {
    workspaces: readonly Workspace[];
    selectedId: string;
    onSelect: (id: string) => void;
  },
): boolean {
  const delta = resolveWorkspaceMoveDelta(event);
  if (delta === null) {
    return false;
  }
  const nextId = getNextWorkspaceId(
    options.workspaces,
    options.selectedId,
    delta,
  );
  if (!nextId) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  if (nextId !== options.selectedId) {
    options.onSelect(nextId);
  }
  return true;
}
