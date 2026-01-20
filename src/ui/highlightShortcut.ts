type HighlightShortcutContext = {
  toggle: () => void;
};

function isHighlightShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  return event.key.toLowerCase() === "h" || event.code === "KeyH";
}

export function handleHighlightShortcut(
  event: KeyboardEvent,
  context: HighlightShortcutContext,
): boolean {
  if (!isHighlightShortcut(event)) {
    return false;
  }
  event.preventDefault();
  context.toggle();
  return true;
}
