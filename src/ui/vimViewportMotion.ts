export type VimViewportPlacement = "top" | "middle" | "bottom";

type ViewportRange = {
  endLineNumber: number;
  startLineNumber: number;
};

type ViewportMotionModel = {
  getLineContent?: (lineNumber: number) => string;
  getLineCount: () => number;
  getLineFirstNonWhitespaceColumn?: (lineNumber: number) => number;
};

type ViewportMotionEditor = {
  focus?: () => void;
  getModel: () => ViewportMotionModel | null;
  getVisibleRanges: () => ViewportRange[];
  setPosition: (position: { column: number; lineNumber: number }) => void;
};

function clampLine(lineNumber: number, model: ViewportMotionModel): number {
  const lineCount = Math.max(model.getLineCount(), 1);
  return Math.min(Math.max(lineNumber, 1), lineCount);
}

function resolveTargetLine(
  range: ViewportRange,
  placement: VimViewportPlacement,
): number {
  if (placement === "top") {
    return range.startLineNumber;
  }
  if (placement === "bottom") {
    return range.endLineNumber;
  }
  return Math.floor((range.startLineNumber + range.endLineNumber) / 2);
}

function firstNonWhitespaceColumn(
  model: ViewportMotionModel,
  lineNumber: number,
): number {
  const monacoColumn = model.getLineFirstNonWhitespaceColumn?.(lineNumber);
  if (monacoColumn && monacoColumn > 0) {
    return monacoColumn;
  }
  const content = model.getLineContent?.(lineNumber) ?? "";
  const match = content.match(/\S/);
  return match ? match.index! + 1 : 1;
}

export function moveToViewportLine(
  editor: ViewportMotionEditor,
  placement: VimViewportPlacement,
): boolean {
  const model = editor.getModel();
  const visible = editor.getVisibleRanges()[0];
  if (!model || !visible) {
    return false;
  }

  const lineNumber = clampLine(resolveTargetLine(visible, placement), model);
  editor.setPosition({
    lineNumber,
    column: firstNonWhitespaceColumn(model, lineNumber),
  });
  editor.focus?.();
  return true;
}
