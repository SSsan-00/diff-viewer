import type { PairedOp } from "../diffEngine/types";

export type WrappedAlignmentEditor = {
  getModel: () => { getLineCount: () => number } | null;
  getTopForLineNumber: (lineNumber: number, includeViewZones?: boolean) => number;
  getBottomForLineNumber: (lineNumber: number, includeViewZones?: boolean) => number;
};

export type WrappedAlignmentZone = {
  afterLineNumber: number;
  heightInPx: number;
  className: string;
};

function getVisualLineHeight(editor: WrappedAlignmentEditor, lineNumber: number): number {
  const lineCount = editor.getModel()?.getLineCount() ?? 0;
  if (lineNumber < 1 || lineNumber > lineCount) {
    return 0;
  }
  const top = editor.getTopForLineNumber(lineNumber, false);
  const bottom = editor.getBottomForLineNumber(lineNumber, false);
  return Math.max(0, bottom - top);
}

function appendZone(
  zones: WrappedAlignmentZone[],
  afterLineNumber: number,
  heightInPx: number,
  className: string,
): void {
  if (heightInPx < 0.5) {
    return;
  }
  const last = zones[zones.length - 1];
  if (last && last.afterLineNumber === afterLineNumber && last.className === className) {
    last.heightInPx += heightInPx;
    return;
  }
  zones.push({ afterLineNumber, heightInPx, className });
}

export function buildWrappedAlignmentZones(
  ops: readonly PairedOp[],
  leftEditor: WrappedAlignmentEditor,
  rightEditor: WrappedAlignmentEditor,
): { left: WrappedAlignmentZone[]; right: WrappedAlignmentZone[] } {
  const left: WrappedAlignmentZone[] = [];
  const right: WrappedAlignmentZone[] = [];
  let consumedLeftLines = 0;
  let consumedRightLines = 0;

  for (const op of ops) {
    if (op.type === "equal" || op.type === "replace") {
      consumedLeftLines += 1;
      consumedRightLines += 1;
      const leftHeight = getVisualLineHeight(leftEditor, consumedLeftLines);
      const rightHeight = getVisualLineHeight(rightEditor, consumedRightLines);
      if (leftHeight < rightHeight) {
        appendZone(left, consumedLeftLines, rightHeight - leftHeight, "diff-zone-wrap");
      } else if (rightHeight < leftHeight) {
        appendZone(right, consumedRightLines, leftHeight - rightHeight, "diff-zone-wrap");
      }
      continue;
    }

    if (op.type === "insert") {
      consumedRightLines += 1;
      appendZone(
        left,
        consumedLeftLines,
        getVisualLineHeight(rightEditor, consumedRightLines),
        "diff-zone-insert",
      );
      continue;
    }

    consumedLeftLines += 1;
    appendZone(
      right,
      consumedRightLines,
      getVisualLineHeight(leftEditor, consumedLeftLines),
      "diff-zone-delete",
    );
  }

  return { left, right };
}
