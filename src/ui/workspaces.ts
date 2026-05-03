import type { Workspace } from "../storage/workspaces";

export type WorkspaceActionType = "select" | "export" | "rename" | "remove";

export type WorkspaceAction = {
  type: WorkspaceActionType;
  id: string;
};

export type WorkspaceDragMove = {
  from: number;
  to: number;
};

export function renderWorkspaces(
  container: HTMLElement,
  workspaces: readonly Workspace[],
  options: {
    selectedId: string;
    editingId: string | null;
    focusedId?: string | null;
  },
): void {
  const doc = container.ownerDocument;
  container.textContent = "";
  container.setAttribute("role", "listbox");

  const fragment = doc.createDocumentFragment();
  workspaces.forEach((workspace, index) => {
    const item = doc.createElement("div");
    item.className = "workspace-item";
    item.dataset.id = workspace.id;
    item.dataset.index = String(index);
    item.setAttribute("role", "option");
    const isSelected = workspace.id === options.selectedId;
    if (isSelected) {
      item.classList.add("workspace-item--selected");
    }
    const isFocused = workspace.id === options.focusedId;
    if (isFocused) {
      item.classList.add("workspace-item--focused");
    }
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
    item.setAttribute("data-selected", isSelected ? "true" : "false");
    item.setAttribute("data-focused", isFocused ? "true" : "false");

    const dragHandle = doc.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "workspace-item__drag";
    dragHandle.dataset.dragHandle = "true";
    dragHandle.title = "並び替え";
    dragHandle.setAttribute("aria-label", "並び替え");
    dragHandle.textContent = "≡";
    dragHandle.draggable = true;

    const content = doc.createElement("div");
    content.className = "workspace-item__content";

    if (workspace.id === options.editingId) {
      const input = doc.createElement("input");
      input.type = "text";
      input.className = "workspace-item__input";
      input.value = workspace.name;
      input.maxLength = 25;
      input.dataset.action = "rename-input";
      input.setAttribute("aria-label", "ワークスペース名");
      content.appendChild(input);
    } else {
      const nameButton = doc.createElement("button");
      nameButton.type = "button";
      nameButton.className = "workspace-item__name";
      nameButton.dataset.action = "select";
      nameButton.textContent = workspace.name;
      nameButton.title = workspace.name;
      content.appendChild(nameButton);
    }

    const actions = doc.createElement("div");
    actions.className = "workspace-item__actions";

    const exportButton = doc.createElement("button");
    exportButton.type = "button";
    exportButton.className = "workspace-item__action";
    exportButton.dataset.action = "export";
    exportButton.textContent = "⇩";
    exportButton.title = "エクスポート";
    exportButton.setAttribute("aria-label", "エクスポート");

    const rename = doc.createElement("button");
    rename.type = "button";
    rename.className = "workspace-item__action";
    rename.dataset.action = "rename";
    rename.textContent = "✎";
    rename.title = "リネーム";
    rename.setAttribute("aria-label", "リネーム");

    const remove = doc.createElement("button");
    remove.type = "button";
    remove.className = "workspace-item__action";
    remove.dataset.action = "remove";
    remove.textContent = "🗑";
    remove.title = "削除";
    remove.setAttribute("aria-label", "削除");

    actions.append(exportButton, rename, remove);
    item.append(dragHandle, content, actions);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

export function applyWorkspaceFocus(
  container: HTMLElement,
  focusedId: string | null,
): void {
  container.querySelectorAll<HTMLElement>(".workspace-item").forEach((item) => {
    const isFocused = focusedId !== null && item.dataset.id === focusedId;
    item.classList.toggle("workspace-item--focused", isFocused);
    item.setAttribute("data-focused", isFocused ? "true" : "false");
  });
}

export function getWorkspaceAction(target: HTMLElement): WorkspaceAction | null {
  const button = target.closest<HTMLElement>("[data-action]");
  const source = button ?? target.closest<HTMLElement>(".workspace-item");
  if (!source) {
    return null;
  }
  const action = (source.dataset.action ?? "select") as
    | WorkspaceActionType
    | undefined;
  if (!action) {
    return null;
  }
  const item = source.closest<HTMLElement>(".workspace-item");
  if (!item) {
    return null;
  }
  const id = item.dataset.id;
  if (!id) {
    return null;
  }
  return { type: action, id };
}

export function bindWorkspaceDragHandlers(
  container: HTMLElement,
  onMove: (move: WorkspaceDragMove) => void,
): void {
  let dragIndex: number | null = null;

  const clearDragState = () => {
    dragIndex = null;
    container
      .querySelectorAll(".workspace-item--dragging, .workspace-item--drop-target")
      .forEach((node) => {
        node.classList.remove(
          "workspace-item--dragging",
          "workspace-item--drop-target",
        );
      });
  };

  container.addEventListener("dragstart", (event) => {
    const handle = (event.target as HTMLElement).closest("[data-drag-handle]");
    if (!handle) {
      return;
    }
    const item = handle.closest<HTMLElement>(".workspace-item");
    if (!item) {
      return;
    }
    const index = Number(item.dataset.index);
    if (!Number.isFinite(index)) {
      return;
    }
    dragIndex = index;
    item.classList.add("workspace-item--dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.setData("application/x-workspace", "1");
      event.dataTransfer.setDragImage(item, 12, 12);
    }
  });

  container.addEventListener("dragover", (event) => {
    if (dragIndex === null) {
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>(".workspace-item");
    if (!item) {
      return;
    }
    event.preventDefault();
    if (item.classList.contains("workspace-item--dragging")) {
      return;
    }
    container
      .querySelectorAll(".workspace-item--drop-target")
      .forEach((node) => node.classList.remove("workspace-item--drop-target"));
    item.classList.add("workspace-item--drop-target");
  });

  container.addEventListener("drop", (event) => {
    if (dragIndex === null) {
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>(".workspace-item");
    if (!item) {
      clearDragState();
      return;
    }
    event.preventDefault();
    const targetIndex = Number(item.dataset.index);
    const from = dragIndex;
    clearDragState();
    if (!Number.isFinite(targetIndex) || from === targetIndex) {
      return;
    }
    onMove({ from, to: targetIndex });
  });

  container.addEventListener("dragend", () => {
    clearDragState();
  });
}
