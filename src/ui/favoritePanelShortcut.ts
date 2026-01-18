import type { FavoritePanelController } from "./favoritePanel";

export type FavoritePanelSide = "left" | "right";

type FavoritePanelShortcutContext = {
  left: FavoritePanelController;
  right: FavoritePanelController;
  getLastFocused: () => FavoritePanelSide | null;
};

function isFavoritePanelShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  return event.key.toLowerCase() === "p" || event.code === "KeyP";
}

export function handleFavoritePanelShortcut(
  event: KeyboardEvent,
  context: FavoritePanelShortcutContext,
): boolean {
  if (!isFavoritePanelShortcut(event)) {
    return false;
  }
  event.preventDefault();
  const side = context.getLastFocused() ?? "left";
  const target = side === "left" ? context.left : context.right;
  const other = side === "left" ? context.right : context.left;
  if (target.isOpen()) {
    target.close();
  } else {
    other.close();
    target.open();
  }
  return true;
}
