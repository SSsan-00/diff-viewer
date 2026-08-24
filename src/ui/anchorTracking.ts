import type { Anchor } from "../diffEngine/anchors";

export type ContentChangeLike = {
  readonly range: {
    readonly startLineNumber: number;
    readonly startColumn: number;
    readonly endLineNumber: number;
    readonly endColumn: number;
  };
  readonly text: string;
};

export type TrackedLineResult = {
  lineNo: number;
  stale: boolean;
};

export type AnchorSide = "left" | "right";

export type TrackedAnchorResult = {
  anchor: Anchor;
  stale: boolean;
};

type PreparedContentChange = Readonly<{
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  removedLineBreaks: number;
  insertedLineBreaks: number;
  preservesFollowingLineBoundary: boolean;
}>;

export type PreparedContentChanges = readonly PreparedContentChange[];

function countLineBreaks(text: string): number {
  return text.split(/\r\n|\r|\n/).length - 1;
}

function endsWithLineBreak(text: string): boolean {
  return text.endsWith("\n") || text.endsWith("\r");
}

function comparePreparedChangesDescending(
  left: PreparedContentChange,
  right: PreparedContentChange,
): number {
  return (
    right.startLineNumber - left.startLineNumber ||
    right.startColumn - left.startColumn ||
    right.endLineNumber - left.endLineNumber ||
    right.endColumn - left.endColumn
  );
}

export function prepareContentChanges(
  changes: readonly ContentChangeLike[],
): PreparedContentChanges {
  return [...changes]
    .map((change): PreparedContentChange => {
      const text = change.text;
      return {
        startLineNumber: change.range.startLineNumber,
        startColumn: change.range.startColumn,
        endLineNumber: change.range.endLineNumber,
        endColumn: change.range.endColumn,
        removedLineBreaks:
          change.range.endLineNumber - change.range.startLineNumber,
        insertedLineBreaks: countLineBreaks(text),
        preservesFollowingLineBoundary:
          text === "" || endsWithLineBreak(text),
      };
    })
    .sort(comparePreparedChangesDescending);
}

function transformTrackedLineWithOrderedChanges(
  lineNo: number,
  orderedChanges: PreparedContentChanges,
): TrackedLineResult {
  const originalLineNo = lineNo;
  let nextLineNo = lineNo;

  for (const change of orderedChanges) {
    const trackedLineNumber = nextLineNo + 1;

    const isInsertionAtTrackedLineStart =
      change.startLineNumber === trackedLineNumber &&
      change.startColumn === 1 &&
      change.endLineNumber === trackedLineNumber &&
      change.endColumn === 1;
    const changesWholeLinesBeforeTracked =
      change.startLineNumber < trackedLineNumber &&
      change.startColumn === 1 &&
      change.endLineNumber === trackedLineNumber &&
      change.endColumn === 1 &&
      change.preservesFollowingLineBoundary;
    const endsBeforeTrackedContent =
      change.endLineNumber < trackedLineNumber ||
      isInsertionAtTrackedLineStart ||
      changesWholeLinesBeforeTracked;
    if (endsBeforeTrackedContent) {
      nextLineNo += change.insertedLineBreaks - change.removedLineBreaks;
      continue;
    }

    if (change.startLineNumber > trackedLineNumber) {
      continue;
    }

    const isInlineNonStructuralChange =
      change.startLineNumber === trackedLineNumber &&
      change.endLineNumber === trackedLineNumber &&
      change.insertedLineBreaks === 0;
    if (isInlineNonStructuralChange) {
      continue;
    }

    return { lineNo: originalLineNo, stale: true };
  }

  return { lineNo: nextLineNo, stale: false };
}

export function transformTrackedLine(
  lineNo: number,
  changes: readonly ContentChangeLike[],
): TrackedLineResult {
  // Monaco reports every range in the pre-change model. Processing from the
  // bottom keeps an already-shifted tracked line comparable with the remaining
  // original-coordinate ranges.
  return transformTrackedLineWithPreparedChanges(
    lineNo,
    prepareContentChanges(changes),
  );
}

export function transformTrackedLineWithPreparedChanges(
  lineNo: number,
  changes: PreparedContentChanges,
): TrackedLineResult {
  return transformTrackedLineWithOrderedChanges(lineNo, changes);
}

export function transformAnchorsForContentChanges(
  anchors: readonly Anchor[],
  side: AnchorSide,
  changes: readonly ContentChangeLike[],
): TrackedAnchorResult[] {
  return transformAnchorsWithPreparedChanges(
    anchors,
    side,
    prepareContentChanges(changes),
  );
}

export function transformAnchorsWithPreparedChanges(
  anchors: readonly Anchor[],
  side: AnchorSide,
  changes: PreparedContentChanges,
): TrackedAnchorResult[] {
  return anchors.map((anchor) => {
    const lineNo = side === "left" ? anchor.leftLineNo : anchor.rightLineNo;
    const tracked = transformTrackedLineWithOrderedChanges(lineNo, changes);
    return {
      anchor:
        side === "left"
          ? { ...anchor, leftLineNo: tracked.lineNo }
          : { ...anchor, rightLineNo: tracked.lineNo },
      stale: tracked.stale,
    };
  });
}
