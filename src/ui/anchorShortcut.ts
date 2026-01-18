type AnchorShortcutContext = {
  left: {
    hasTextFocus: () => boolean;
    getPosition: () => { lineNumber: number } | null;
  };
  right: {
    hasTextFocus: () => boolean;
    getPosition: () => { lineNumber: number } | null;
  };
  onLeft: (lineNo: number) => void;
  onRight: (lineNo: number) => void;
};

export function handleAnchorShortcut(
  event: KeyboardEvent,
  context: AnchorShortcutContext,
): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key !== "l" && event.code !== "KeyL") {
    return false;
  }
  if (context.left.hasTextFocus()) {
    const lineNumber = context.left.getPosition()?.lineNumber;
    if (!lineNumber) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    context.onLeft(lineNumber - 1);
    return true;
  }
  if (context.right.hasTextFocus()) {
    const lineNumber = context.right.getPosition()?.lineNumber;
    if (!lineNumber) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    context.onRight(lineNumber - 1);
    return true;
  }
  return false;
}
