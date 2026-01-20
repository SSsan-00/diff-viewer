type PaneClearShortcutContext = {
  clearFocused: () => void;
  clearAll: () => void;
};

function isPaneClearShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key.toLowerCase() === "i" || event.code === "KeyI";
}

export function handlePaneClearShortcut(
  event: KeyboardEvent,
  context: PaneClearShortcutContext,
): boolean {
  if (!isPaneClearShortcut(event)) {
    return false;
  }
  event.preventDefault();
  if (event.shiftKey) {
    context.clearAll();
  } else {
    context.clearFocused();
  }
  return true;
}
