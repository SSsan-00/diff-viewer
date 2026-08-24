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

export type ContentChangeTrackingContext = Readonly<{
  /** Returns the pre-change content of a one-based Monaco line. */
  getBeforeLineContent: (lineNumber: number) => string | undefined;
}>;

type PreparedContentChange = Readonly<{
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  removedLineBreaks: number;
  insertedLineBreaks: number;
  preservesFollowingLineBoundary: boolean;
  replacementLines: readonly string[];
  text: string;
}>;

export type PreparedContentChanges = readonly PreparedContentChange[];

type LineOccurrence = Readonly<{
  count: number;
  lineNumber: number;
}>;

type StructuralChangeAnalysis = Readonly<{
  completeReplacementOccurrences: ReadonlyMap<string, LineOccurrence>;
  completeSourceOccurrences: ReadonlyMap<string, number> | null;
}>;

type StructuralTrackingCache = {
  analyses: Map<PreparedContentChange, StructuralChangeAnalysis>;
  beforeLineContents: Map<number, string | undefined>;
  context: ContentChangeTrackingContext;
};

const structuralTrackingCaches = new WeakMap<
  object,
  WeakMap<ContentChangeTrackingContext, StructuralTrackingCache>
>();

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
      const replacementLines = text.split(/\r\n|\r|\n/);
      return {
        startLineNumber: change.range.startLineNumber,
        startColumn: change.range.startColumn,
        endLineNumber: change.range.endLineNumber,
        endColumn: change.range.endColumn,
        removedLineBreaks:
          change.range.endLineNumber - change.range.startLineNumber,
        insertedLineBreaks: replacementLines.length - 1,
        preservesFollowingLineBoundary:
          text === "" || endsWithLineBreak(text),
        replacementLines,
        text,
      };
    })
    .sort(comparePreparedChangesDescending);
}

function transformTrackedLineWithOrderedChanges(
  lineNo: number,
  orderedChanges: PreparedContentChanges,
  context?: ContentChangeTrackingContext,
): TrackedLineResult {
  const originalLineNo = lineNo;
  let nextLineNo = lineNo;
  const trackingCache = context
    ? getStructuralTrackingCache(orderedChanges, context)
    : undefined;

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

    const structurallyTrackedLineNo = resolveStructuralChange(
      trackedLineNumber,
      change,
      trackingCache,
    );
    if (structurallyTrackedLineNo !== null) {
      nextLineNo = structurallyTrackedLineNo - 1;
      continue;
    }

    return { lineNo: originalLineNo, stale: true };
  }

  return { lineNo: nextLineNo, stale: false };
}

export function transformTrackedLine(
  lineNo: number,
  changes: readonly ContentChangeLike[],
  context?: ContentChangeTrackingContext,
): TrackedLineResult {
  // Monaco reports every range in the pre-change model. Processing from the
  // bottom keeps an already-shifted tracked line comparable with the remaining
  // original-coordinate ranges.
  return transformTrackedLineWithPreparedChanges(
    lineNo,
    prepareContentChanges(changes),
    context,
  );
}

export function transformTrackedLineWithPreparedChanges(
  lineNo: number,
  changes: PreparedContentChanges,
  context?: ContentChangeTrackingContext,
): TrackedLineResult {
  return transformTrackedLineWithOrderedChanges(lineNo, changes, context);
}

export function transformAnchorsForContentChanges(
  anchors: readonly Anchor[],
  side: AnchorSide,
  changes: readonly ContentChangeLike[],
  context?: ContentChangeTrackingContext,
): TrackedAnchorResult[] {
  return transformAnchorsWithPreparedChanges(
    anchors,
    side,
    prepareContentChanges(changes),
    context,
  );
}

export function transformAnchorsWithPreparedChanges(
  anchors: readonly Anchor[],
  side: AnchorSide,
  changes: PreparedContentChanges,
  context?: ContentChangeTrackingContext,
): TrackedAnchorResult[] {
  return anchors.map((anchor) => {
    const lineNo = side === "left" ? anchor.leftLineNo : anchor.rightLineNo;
    const tracked = transformTrackedLineWithOrderedChanges(
      lineNo,
      changes,
      context,
    );
    return {
      anchor:
        side === "left"
          ? { ...anchor, leftLineNo: tracked.lineNo }
          : { ...anchor, rightLineNo: tracked.lineNo },
      stale: tracked.stale,
    };
  });
}

function resolveStructuralChange(
  trackedLineNumber: number,
  change: PreparedContentChange,
  cache: StructuralTrackingCache | undefined,
): number | null {
  if (!cache) {
    return null;
  }

  const trackedLine = getBeforeLineContent(cache, trackedLineNumber);
  if (trackedLine === undefined) {
    return null;
  }

  const isInsertionAtTrackedLineEnd =
    change.startLineNumber === trackedLineNumber &&
    change.endLineNumber === trackedLineNumber &&
    change.startColumn === trackedLine.length + 1 &&
    change.endColumn === trackedLine.length + 1 &&
    change.insertedLineBreaks > 0;
  if (isInsertionAtTrackedLineEnd) {
    return trackedLineNumber;
  }

  const startLine = getBeforeLineContent(cache, change.startLineNumber);
  const startsOnLineEnd =
    startLine !== undefined &&
    change.endLineNumber === change.startLineNumber + 1 &&
    change.startColumn === startLine.length + 1;
  const deletesOnlyOneAdjacentLineBreak =
    change.text === "" &&
    startsOnLineEnd &&
    change.endColumn === 1;
  if (deletesOnlyOneAdjacentLineBreak) {
    if (trackedLineNumber === change.startLineNumber) {
      return trackedLineNumber;
    }
    if (trackedLineNumber === change.endLineNumber) {
      return trackedLineNumber - 1;
    }
  }

  const fullyCoversTrackedLine = changeFullyCoversLine(
    change,
    trackedLineNumber,
    trackedLine,
  );
  if (!fullyCoversTrackedLine || change.text === "") {
    return null;
  }

  const analysis = getStructuralChangeAnalysis(change, cache);
  if (analysis.completeSourceOccurrences?.get(trackedLine) !== 1) {
    return null;
  }

  const replacementOccurrence =
    analysis.completeReplacementOccurrences.get(trackedLine);
  return replacementOccurrence?.count === 1
    ? replacementOccurrence.lineNumber
    : null;
}

function getStructuralTrackingCache(
  changes: PreparedContentChanges,
  context: ContentChangeTrackingContext,
): StructuralTrackingCache {
  let cachesByContext = structuralTrackingCaches.get(changes);
  if (!cachesByContext) {
    cachesByContext = new WeakMap();
    structuralTrackingCaches.set(changes, cachesByContext);
  }
  let cache = cachesByContext.get(context);
  if (!cache) {
    cache = {
      analyses: new Map(),
      beforeLineContents: new Map(),
      context,
    };
    cachesByContext.set(context, cache);
  }
  return cache;
}

function getBeforeLineContent(
  cache: StructuralTrackingCache,
  lineNumber: number,
): string | undefined {
  if (!cache.beforeLineContents.has(lineNumber)) {
    cache.beforeLineContents.set(
      lineNumber,
      cache.context.getBeforeLineContent(lineNumber),
    );
  }
  return cache.beforeLineContents.get(lineNumber);
}

function getStructuralChangeAnalysis(
  change: PreparedContentChange,
  cache: StructuralTrackingCache,
): StructuralChangeAnalysis {
  const cached = cache.analyses.get(change);
  if (cached) {
    return cached;
  }

  const completeSourceOccurrences = new Map<string, number>();
  let hasCompleteSourceContext = true;
  for (
    let lineNumber = change.startLineNumber;
    lineNumber <= change.endLineNumber;
    lineNumber += 1
  ) {
    const line = getBeforeLineContent(cache, lineNumber);
    if (line === undefined) {
      hasCompleteSourceContext = false;
      break;
    }
    if (changeFullyCoversLine(change, lineNumber, line)) {
      completeSourceOccurrences.set(
        line,
        (completeSourceOccurrences.get(line) ?? 0) + 1,
      );
    }
  }

  const endLine = getBeforeLineContent(cache, change.endLineNumber);
  const replacementEndsAtLineEnd =
    endLine !== undefined && change.endColumn === endLine.length + 1;
  const completeReplacementOccurrences = new Map<string, LineOccurrence>();
  change.replacementLines.forEach((line, index) => {
    const beginsAtLineBoundary = index > 0 || change.startColumn === 1;
    const endsAtLineBoundary =
      index < change.replacementLines.length - 1 || replacementEndsAtLineEnd;
    if (!beginsAtLineBoundary || !endsAtLineBoundary) {
      return;
    }
    const existing = completeReplacementOccurrences.get(line);
    completeReplacementOccurrences.set(line, {
      count: (existing?.count ?? 0) + 1,
      lineNumber: existing?.lineNumber ?? change.startLineNumber + index,
    });
  });

  const analysis = {
    completeReplacementOccurrences,
    completeSourceOccurrences: hasCompleteSourceContext
      ? completeSourceOccurrences
      : null,
  };
  cache.analyses.set(change, analysis);
  return analysis;
}

function changeFullyCoversLine(
  change: PreparedContentChange,
  lineNumber: number,
  line: string,
): boolean {
  const coversStart =
    change.startLineNumber < lineNumber ||
    (change.startLineNumber === lineNumber && change.startColumn === 1);
  const coversEnd =
    change.endLineNumber > lineNumber ||
    (change.endLineNumber === lineNumber &&
      line.length > 0 &&
      change.endColumn === line.length + 1);
  return coversStart && coversEnd;
}
