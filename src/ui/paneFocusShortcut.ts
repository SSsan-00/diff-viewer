type VisibleRangeProvider = {
  getVisibleRanges: () => { startLineNumber: number; endLineNumber: number }[];
  getTopForLineNumber: (lineNumber: number) => number;
  getPosition: () => { lineNumber: number } | null;
};

type PositionSetter = {
  setPosition: (position: { lineNumber: number; column: number }) => void;
  focus: () => void;
};

type RevealSupport = {
  revealLineInCenter?: (lineNumber: number) => void;
  revealLine?: (lineNumber: number) => void;
  getModel?: () => { getLineCount: () => number } | null;
  hasTextFocus?: () => boolean;
};

export function findClosestVisibleLine(
  editor: VisibleRangeProvider,
  targetTop: number,
): number | null {
  const visible = editor.getVisibleRanges();
  const range = visible[0];
  if (!range) {
    return null;
  }
  let lo = range.startLineNumber;
  let hi = range.endLineNumber;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const top = editor.getTopForLineNumber(mid);
    if (top < targetTop) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const candidates = [hi, lo].filter(
    (line) => line >= range.startLineNumber && line <= range.endLineNumber,
  );
  if (candidates.length === 0) {
    return range.startLineNumber;
  }
  let best = candidates[0];
  let bestDelta = Math.abs(editor.getTopForLineNumber(best) - targetTop);
  for (const line of candidates.slice(1)) {
    const delta = Math.abs(editor.getTopForLineNumber(line) - targetTop);
    if (delta < bestDelta) {
      best = line;
      bestDelta = delta;
    }
  }
  return best;
}

export function focusEditorAtTop(editor: VisibleRangeProvider & PositionSetter): void {
  const visible = editor.getVisibleRanges();
  const lineNumber = visible[0]?.startLineNumber ?? 1;
  editor.setPosition({ lineNumber, column: 1 });
  editor.focus();
}

export function focusEditorAtAlignedLine(
  fromEditor: VisibleRangeProvider,
  targetEditor: VisibleRangeProvider & PositionSetter & RevealSupport,
): void {
  const fromPosition = fromEditor.getPosition();
  if (!fromPosition) {
    focusEditorAtTop(targetEditor);
    return;
  }
  const fromTop = fromEditor.getTopForLineNumber(fromPosition.lineNumber);
  const matched = findClosestVisibleLine(targetEditor, fromTop);
  if (!matched) {
    focusEditorAtTop(targetEditor);
    return;
  }
  const maxLine = targetEditor.getModel?.()?.getLineCount?.() ?? matched;
  const lineNumber = Math.min(Math.max(matched, 1), maxLine);
  targetEditor.setPosition({ lineNumber, column: 1 });
  if (targetEditor.revealLineInCenter) {
    targetEditor.revealLineInCenter(lineNumber);
  } else if (targetEditor.revealLine) {
    targetEditor.revealLine(lineNumber);
  }
  targetEditor.focus();
}

export function handlePaneFocusShortcut(
  event: KeyboardEvent,
  options: {
    leftEditor: VisibleRangeProvider & PositionSetter & RevealSupport;
    rightEditor: VisibleRangeProvider & PositionSetter & RevealSupport;
  },
): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key === "j" || event.code === "KeyJ") {
    event.preventDefault();
    event.stopPropagation();
    const fromEditor = options.rightEditor.hasTextFocus?.()
      ? options.rightEditor
      : options.leftEditor;
    focusEditorAtAlignedLine(fromEditor, options.leftEditor);
    return true;
  }
  if (key === "k" || event.code === "KeyK") {
    event.preventDefault();
    event.stopPropagation();
    const fromEditor = options.leftEditor.hasTextFocus?.()
      ? options.leftEditor
      : options.rightEditor;
    focusEditorAtAlignedLine(fromEditor, options.rightEditor);
    return true;
  }
  return false;
}
