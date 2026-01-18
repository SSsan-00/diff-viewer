export type FavoritePathActionType = "copy" | "remove";

export type FavoritePathDragMove = {
  from: number;
  to: number;
};

export interface FavoritePathAction {
  type: FavoritePathActionType;
  index: number;
  path: string;
}

export type FavoritePathRenderOptions = {
  focusedIndex?: number | null;
};

export function applyFavoritePathFocus(
  container: HTMLElement,
  focusedIndex: number | null,
): void {
  const items = Array.from(
    container.querySelectorAll<HTMLElement>(".favorite-path"),
  );
  for (const item of items) {
    const index = Number(item.dataset.index);
    const isSelected =
      focusedIndex !== null && Number.isFinite(index) && index === focusedIndex;
    item.tabIndex = isSelected ? 0 : -1;
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
    item.setAttribute("data-selected", isSelected ? "true" : "false");
    item.classList.toggle("is-focused", isSelected);
  }
}

export function renderFavoritePaths(
  container: HTMLElement,
  paths: readonly string[],
  options?: FavoritePathRenderOptions,
): void {
  const doc = container.ownerDocument;
  container.textContent = "";
  container.setAttribute("role", "listbox");

  const fragment = doc.createDocumentFragment();
  paths.forEach((path, index) => {
    const item = doc.createElement("div");
    item.className = "favorite-path";
    item.dataset.index = String(index);
    item.dataset.path = path;
    item.setAttribute("role", "option");

    const dragHandle = doc.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "favorite-path__drag";
    dragHandle.dataset.dragHandle = "true";
    dragHandle.title = "並び替え";
    dragHandle.setAttribute("aria-label", "並び替え");
    dragHandle.textContent = "≡";
    dragHandle.draggable = true;

    const label = doc.createElement("div");
    label.className = "favorite-path__label";
    label.textContent = path;

    const copyButton = doc.createElement("button");
    copyButton.type = "button";
    copyButton.className = "favorite-path__copy";
    copyButton.dataset.action = "copy";
    copyButton.textContent = "コピー";
    copyButton.title = path;
    copyButton.setAttribute("aria-label", path);
    copyButton.disabled = false;

    const actions = doc.createElement("div");
    actions.className = "favorite-path__actions";

    const remove = doc.createElement("button");
    remove.type = "button";
    remove.className = "favorite-path__action favorite-path__remove";
    remove.dataset.action = "remove";
    remove.textContent = "×";
    remove.title = "削除";

    actions.append(copyButton, remove);
    item.append(dragHandle, label, actions);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
  const focusedIndex = options?.focusedIndex ?? null;
  applyFavoritePathFocus(container, focusedIndex);
}

export function getFavoritePathAction(
  target: HTMLElement,
): FavoritePathAction | null {
  const button = target.closest<HTMLButtonElement>("[data-action]");
  if (!button) {
    return null;
  }
  const action = button.dataset.action as FavoritePathActionType | undefined;
  if (!action) {
    return null;
  }
  const item = button.closest<HTMLElement>(".favorite-path");
  if (!item) {
    return null;
  }
  const index = Number(item.dataset.index);
  if (!Number.isFinite(index)) {
    return null;
  }
  const path = item.dataset.path ?? "";
  if (!path) {
    return null;
  }
  return { type: action, index, path };
}

export function bindFavoritePathHandlers(
  container: HTMLElement,
  onAction: (action: FavoritePathAction) => void,
): void {
  container.addEventListener("click", (event) => {
    const action = getFavoritePathAction(event.target as HTMLElement);
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onAction(action);
  });
}

export function bindFavoritePathDragHandlers(
  container: HTMLElement,
  onMove: (move: FavoritePathDragMove) => void,
): void {
  let dragIndex: number | null = null;

  const clearDragState = () => {
    dragIndex = null;
    container
      .querySelectorAll(".favorite-path--dragging, .favorite-path--drop-target")
      .forEach((node) => {
        node.classList.remove(
          "favorite-path--dragging",
          "favorite-path--drop-target",
        );
      });
  };

  container.addEventListener("dragstart", (event) => {
    const handle = (event.target as HTMLElement).closest("[data-drag-handle]");
    if (!handle) {
      return;
    }
    const item = handle.closest<HTMLElement>(".favorite-path");
    if (!item) {
      return;
    }
    const index = Number(item.dataset.index);
    if (!Number.isFinite(index)) {
      return;
    }
    dragIndex = index;
    item.classList.add("favorite-path--dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.setData("application/x-favorite-path", "1");
      event.dataTransfer.setDragImage(item, 12, 12);
    }
  });

  container.addEventListener("dragover", (event) => {
    if (dragIndex === null) {
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      ".favorite-path",
    );
    if (!item) {
      return;
    }
    event.preventDefault();
    if (item.classList.contains("favorite-path--dragging")) {
      return;
    }
    container
      .querySelectorAll(".favorite-path--drop-target")
      .forEach((node) => node.classList.remove("favorite-path--drop-target"));
    item.classList.add("favorite-path--drop-target");
  });

  container.addEventListener("drop", (event) => {
    if (dragIndex === null) {
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      ".favorite-path",
    );
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
