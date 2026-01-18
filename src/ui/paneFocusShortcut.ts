type VisibleRangeProvider = {
  getVisibleRanges: () => { startLineNumber: number }[];
};

type PositionSetter = {
  setPosition: (position: { lineNumber: number; column: number }) => void;
  focus: () => void;
};

export function focusEditorAtTop(
  editor: VisibleRangeProvider & PositionSetter,
): void {
  const visible = editor.getVisibleRanges();
  const lineNumber = visible[0]?.startLineNumber ?? 1;
  editor.setPosition({ lineNumber, column: 1 });
  editor.focus();
}

export function handlePaneFocusShortcut(
  event: KeyboardEvent,
  options: { focusLeft: () => void; focusRight: () => void },
): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key === "j" || event.code === "KeyJ") {
    event.preventDefault();
    event.stopPropagation();
    options.focusLeft();
    return true;
  }
  if (key === "k" || event.code === "KeyK") {
    event.preventDefault();
    event.stopPropagation();
    options.focusRight();
    return true;
  }
  return false;
}
