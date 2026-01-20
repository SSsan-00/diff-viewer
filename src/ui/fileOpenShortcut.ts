type FileOpenShortcutContext = {
  openLeft: () => void;
  openRight: () => void;
  getLastFocused: () => "left" | "right";
};

function isFileOpenShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key.toLowerCase() === "u" || event.code === "KeyU";
}

export function handleFileOpenShortcut(
  event: KeyboardEvent,
  context: FileOpenShortcutContext,
): boolean {
  if (!isFileOpenShortcut(event)) {
    return false;
  }
  event.preventDefault();
  const side = context.getLastFocused();
  if (side === "left") {
    context.openLeft();
  } else {
    context.openRight();
  }
  return true;
}
