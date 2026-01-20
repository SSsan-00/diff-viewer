type ThemeShortcutContext = {
  toggle: () => void;
};

function isThemeShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  return event.key.toLowerCase() === "t" || event.code === "KeyT";
}

export function handleThemeShortcut(
  event: KeyboardEvent,
  context: ThemeShortcutContext,
): boolean {
  if (!isThemeShortcut(event)) {
    return false;
  }
  event.preventDefault();
  context.toggle();
  return true;
}
