import { normalizeText } from "../diffEngine/normalize";
import type { LineSegment } from "../file/lineNumbering";

export type AnchorReloadPaneSnapshot = {
  text: string;
  segments: readonly LineSegment[];
};

export type AnchorReloadStaleReason =
  | "line-out-of-range"
  | "file-unavailable"
  | "line-changed-or-deleted"
  | "ambiguous-line";

export type AnchorReloadLineResult =
  | { status: "mapped"; lineNo: number }
  | { status: "stale"; reason: AnchorReloadStaleReason };

export type AnchorReloadLineMapper = (
  lineNo: number,
) => AnchorReloadLineResult;

type SegmentBounds = {
  end: number;
  start: number;
};

type LineOccurrence = {
  count: number;
  localLineNo: number;
};

type PreparedSegmentMapping =
  | { status: "unavailable" }
  | {
      status: "ready";
      identical: boolean;
      lineMappings: readonly (number | undefined)[];
      nextBounds: SegmentBounds;
      nextOccurrences: ReadonlyMap<string, LineOccurrence>;
      nextSegment: LineSegment;
      previousBounds: SegmentBounds;
      previousOccurrences: ReadonlyMap<string, LineOccurrence>;
    };

function sameFileSegment(left: LineSegment, right: LineSegment): boolean {
  return left.fileIndex === right.fileIndex && left.fileName === right.fileName;
}

function getSegmentBounds(
  segment: LineSegment,
  lineCount: number,
): SegmentBounds | null {
  const start = segment.startLine - 1;
  const end = start + segment.lineCount;
  if (
    segment.startLine < 1 ||
    segment.lineCount < 1 ||
    start >= lineCount ||
    end > lineCount
  ) {
    return null;
  }
  return { start, end };
}

function buildSegmentLineIndex(
  segments: readonly LineSegment[],
  lineCount: number,
): Array<LineSegment | null | undefined> {
  const index = new Array<LineSegment | null | undefined>(lineCount);
  segments.forEach((segment) => {
    const bounds = getSegmentBounds(segment, lineCount);
    if (!bounds) {
      return;
    }
    for (let lineNo = bounds.start; lineNo < bounds.end; lineNo += 1) {
      index[lineNo] = index[lineNo] === undefined ? segment : null;
    }
  });
  return index;
}

function getPreservedAppendLineCount(text: string): number {
  const normalized = normalizeText(text);
  if (normalized === "") {
    return 0;
  }
  const lines = normalized.split("\n");
  return normalized.endsWith("\n")
    ? Math.max(0, lines.length - 1)
    : lines.length;
}

function buildSegmentsByFile(
  segments: readonly LineSegment[],
): Map<string, LineSegment[]> {
  const byFile = new Map<string, LineSegment[]>();
  segments.forEach((segment) => {
    const key = JSON.stringify([segment.fileIndex, segment.fileName ?? null]);
    const entries = byFile.get(key) ?? [];
    entries.push(segment);
    byFile.set(key, entries);
  });
  return byFile;
}

function getFileKey(segment: LineSegment): string {
  return JSON.stringify([segment.fileIndex, segment.fileName ?? null]);
}

function rangesEqual(
  previousLines: readonly string[],
  previousBounds: SegmentBounds,
  nextLines: readonly string[],
  nextBounds: SegmentBounds,
): boolean {
  const previousLength = previousBounds.end - previousBounds.start;
  const nextLength = nextBounds.end - nextBounds.start;
  if (previousLength !== nextLength) {
    return false;
  }
  for (let offset = 0; offset < previousLength; offset += 1) {
    if (
      previousLines[previousBounds.start + offset] !==
      nextLines[nextBounds.start + offset]
    ) {
      return false;
    }
  }
  return true;
}

function buildLineOccurrences(
  lines: readonly string[],
  bounds: SegmentBounds,
): Map<string, LineOccurrence> {
  const occurrences = new Map<string, LineOccurrence>();
  for (let index = bounds.start; index < bounds.end; index += 1) {
    const line = lines[index] ?? "";
    const existing = occurrences.get(line);
    if (existing) {
      existing.count += 1;
    } else {
      occurrences.set(line, {
        count: 1,
        localLineNo: index - bounds.start,
      });
    }
  }
  return occurrences;
}

type RelativeLinePair = {
  nextLineNo: number;
  previousLineNo: number;
};

type AlignmentRange = {
  nextEnd: number;
  nextStart: number;
  previousEnd: number;
  previousStart: number;
};

function buildUniquePairsForRange(
  previousLines: readonly string[],
  nextLines: readonly string[],
  range: AlignmentRange,
): RelativeLinePair[] {
  const previousOccurrences = buildLineOccurrences(previousLines, {
    start: range.previousStart,
    end: range.previousEnd,
  });
  const nextOccurrences = buildLineOccurrences(nextLines, {
    start: range.nextStart,
    end: range.nextEnd,
  });
  const pairs: RelativeLinePair[] = [];

  // Map preserves first-insertion order, so the pairs are already ordered by
  // their previous line number without an additional sort.
  previousOccurrences.forEach((previousOccurrence, line) => {
    if (previousOccurrence.count !== 1) {
      return;
    }
    const nextOccurrence = nextOccurrences.get(line);
    if (!nextOccurrence || nextOccurrence.count !== 1) {
      return;
    }
    pairs.push({
      previousLineNo: range.previousStart + previousOccurrence.localLineNo,
      nextLineNo: range.nextStart + nextOccurrence.localLineNo,
    });
  });
  return pairs;
}

function getUncontestedPairs(
  pairs: readonly RelativeLinePair[],
): RelativeLinePair[] {
  const maximumBefore = new Array<number>(pairs.length);
  const minimumAfter = new Array<number>(pairs.length);
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < pairs.length; index += 1) {
    maximumBefore[index] = maximum;
    maximum = Math.max(maximum, pairs[index].nextLineNo);
  }
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = pairs.length - 1; index >= 0; index -= 1) {
    minimumAfter[index] = minimum;
    minimum = Math.min(minimum, pairs[index].nextLineNo);
  }
  return pairs.filter(
    (pair, index) =>
      pair.nextLineNo > maximumBefore[index] &&
      pair.nextLineNo < minimumAfter[index],
  );
}

function buildContextualLineMappings(
  previousLines: readonly string[],
  previousBounds: SegmentBounds,
  nextLines: readonly string[],
  nextBounds: SegmentBounds,
): Array<number | undefined> {
  const previousSegmentLines = previousLines.slice(
    previousBounds.start,
    previousBounds.end,
  );
  const nextSegmentLines = nextLines.slice(nextBounds.start, nextBounds.end);
  const mappings = new Array<number | undefined>(previousSegmentLines.length);
  const totalLineCount = previousSegmentLines.length + nextSegmentLines.length;
  const scanBudget =
    totalLineCount * (Math.ceil(Math.log2(totalLineCount + 1)) + 2) * 2;
  let scannedLineCount = 0;
  const pending: AlignmentRange[] = [
    {
      previousStart: 0,
      previousEnd: previousSegmentLines.length,
      nextStart: 0,
      nextEnd: nextSegmentLines.length,
    },
  ];

  while (pending.length > 0) {
    const range = pending.pop();
    if (!range) {
      break;
    }
    let previousStart = range.previousStart;
    let previousEnd = range.previousEnd;
    let nextStart = range.nextStart;
    let nextEnd = range.nextEnd;
    const rangeLineCount =
      previousEnd - previousStart + (nextEnd - nextStart);
    if (scannedLineCount + rangeLineCount > scanBudget) {
      continue;
    }
    scannedLineCount += rangeLineCount;
    const previousRangeOccurrences = buildLineOccurrences(
      previousSegmentLines,
      { start: previousStart, end: previousEnd },
    );
    const nextRangeOccurrences = buildLineOccurrences(nextSegmentLines, {
      start: nextStart,
      end: nextEnd,
    });

    const hasEqualRangeOccurrenceCount = (line: string): boolean =>
      previousRangeOccurrences.get(line)?.count ===
      nextRangeOccurrences.get(line)?.count;

    while (
      previousStart < previousEnd &&
      nextStart < nextEnd &&
      previousSegmentLines[previousStart] === nextSegmentLines[nextStart] &&
      hasEqualRangeOccurrenceCount(previousSegmentLines[previousStart] ?? "")
    ) {
      mappings[previousStart] = nextStart;
      previousStart += 1;
      nextStart += 1;
    }
    while (
      previousStart < previousEnd &&
      nextStart < nextEnd &&
      previousSegmentLines[previousEnd - 1] === nextSegmentLines[nextEnd - 1] &&
      hasEqualRangeOccurrenceCount(previousSegmentLines[previousEnd - 1] ?? "")
    ) {
      previousEnd -= 1;
      nextEnd -= 1;
      mappings[previousEnd] = nextEnd;
    }

    const previousLength = previousEnd - previousStart;
    const nextLength = nextEnd - nextStart;
    if (previousLength === 1 && nextLength === 1) {
      // The remaining bounded range proves this to be one replacement, even
      // when the anchored line itself changed.
      mappings[previousStart] = nextStart;
      continue;
    }
    if (previousLength === 0 || nextLength === 0) {
      continue;
    }

    const unresolvedLineCount = previousLength + nextLength;
    if (scannedLineCount + unresolvedLineCount > scanBudget) {
      // Exhausting the bounded preparation budget leaves uncertain lines stale
      // rather than turning a large reload into quadratic work.
      continue;
    }
    scannedLineCount += unresolvedLineCount;
    const unresolvedRange: AlignmentRange = {
      previousStart,
      previousEnd,
      nextStart,
      nextEnd,
    };
    const pairs = buildUniquePairsForRange(
      previousSegmentLines,
      nextSegmentLines,
      unresolvedRange,
    );
    const anchors = getUncontestedPairs(pairs);
    if (anchors.length === 0) {
      continue;
    }
    let previousCursor = previousStart;
    let nextCursor = nextStart;
    anchors.forEach((anchor) => {
      mappings[anchor.previousLineNo] = anchor.nextLineNo;
      pending.push({
        previousStart: previousCursor,
        previousEnd: anchor.previousLineNo,
        nextStart: nextCursor,
        nextEnd: anchor.nextLineNo,
      });
      previousCursor = anchor.previousLineNo + 1;
      nextCursor = anchor.nextLineNo + 1;
    });
    pending.push({
      previousStart: previousCursor,
      previousEnd,
      nextStart: nextCursor,
      nextEnd,
    });
  }

  return mappings;
}

function createAnchorSnapshotLineMapper(
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
  preserveUnmanagedAppendLines: boolean,
): AnchorReloadLineMapper {
  const previousLines = normalizeText(previous.text).split("\n");
  const nextLines = normalizeText(next.text).split("\n");
  const previousSegmentIndex = buildSegmentLineIndex(
    previous.segments,
    previousLines.length,
  );
  const nextSegmentIndex = buildSegmentLineIndex(next.segments, nextLines.length);
  const previousByFile = buildSegmentsByFile(previous.segments);
  const nextByFile = buildSegmentsByFile(next.segments);
  const preparedBySegment = new Map<LineSegment, PreparedSegmentMapping>();
  const preservedAppendLineCount = preserveUnmanagedAppendLines
    ? getPreservedAppendLineCount(previous.text)
    : 0;

  previous.segments.forEach((previousSegment) => {
    const previousMatches = previousByFile.get(getFileKey(previousSegment)) ?? [];
    const nextMatches = nextByFile.get(getFileKey(previousSegment)) ?? [];
    const previousBounds = getSegmentBounds(previousSegment, previousLines.length);
    const nextSegment = nextMatches[0];
    const nextBounds = nextSegment
      ? getSegmentBounds(nextSegment, nextLines.length)
      : null;
    if (
      previousMatches.length !== 1 ||
      nextMatches.length !== 1 ||
      !previousBounds ||
      !nextSegment ||
      !nextBounds ||
      !sameFileSegment(previousSegment, nextSegment)
    ) {
      preparedBySegment.set(previousSegment, { status: "unavailable" });
      return;
    }

    const identical = rangesEqual(
      previousLines,
      previousBounds,
      nextLines,
      nextBounds,
    );
    preparedBySegment.set(previousSegment, {
      status: "ready",
      identical,
      lineMappings: identical
        ? []
        : buildContextualLineMappings(
            previousLines,
            previousBounds,
            nextLines,
            nextBounds,
          ),
      nextBounds,
      nextOccurrences: identical
        ? new Map<string, LineOccurrence>()
        : buildLineOccurrences(nextLines, nextBounds),
      nextSegment,
      previousBounds,
      previousOccurrences: identical
        ? new Map<string, LineOccurrence>()
        : buildLineOccurrences(previousLines, previousBounds),
    });
  });

  return (lineNo): AnchorReloadLineResult => {
    if (!Number.isInteger(lineNo) || lineNo < 0) {
      return { status: "stale", reason: "line-out-of-range" };
    }
    const previousSegment = previousSegmentIndex[lineNo];
    if (!previousSegment) {
      if (
        previousSegment === undefined &&
        lineNo < preservedAppendLineCount &&
        nextSegmentIndex[lineNo] === undefined &&
        previousLines[lineNo] === nextLines[lineNo]
      ) {
        return { status: "mapped", lineNo };
      }
      return { status: "stale", reason: "line-out-of-range" };
    }
    const prepared = preparedBySegment.get(previousSegment);
    if (!prepared || prepared.status === "unavailable") {
      return { status: "stale", reason: "file-unavailable" };
    }

    const previousLocalLineNo = lineNo - prepared.previousBounds.start;
    if (
      previousLocalLineNo < 0 ||
      lineNo >= prepared.previousBounds.end
    ) {
      return { status: "stale", reason: "line-out-of-range" };
    }

    if (prepared.identical) {
      const mappedLineNo = prepared.nextBounds.start + previousLocalLineNo;
      return nextSegmentIndex[mappedLineNo] === prepared.nextSegment
        ? { status: "mapped", lineNo: mappedLineNo }
        : { status: "stale", reason: "file-unavailable" };
    }

    const contextualNextLocalLineNo =
      prepared.lineMappings[previousLocalLineNo];
    if (contextualNextLocalLineNo !== undefined) {
      const mappedLineNo =
        prepared.nextBounds.start + contextualNextLocalLineNo;
      return nextSegmentIndex[mappedLineNo] === prepared.nextSegment
        ? { status: "mapped", lineNo: mappedLineNo }
        : { status: "stale", reason: "file-unavailable" };
    }

    const anchoredLine = previousLines[lineNo] ?? "";
    const previousOccurrence = prepared.previousOccurrences.get(anchoredLine);
    if (!previousOccurrence || previousOccurrence.count !== 1) {
      return { status: "stale", reason: "ambiguous-line" };
    }
    const nextOccurrence = prepared.nextOccurrences.get(anchoredLine);
    if (!nextOccurrence) {
      return { status: "stale", reason: "line-changed-or-deleted" };
    }
    if (nextOccurrence.count !== 1) {
      return { status: "stale", reason: "ambiguous-line" };
    }

    const mappedLineNo = prepared.nextBounds.start + nextOccurrence.localLineNo;
    return nextSegmentIndex[mappedLineNo] === prepared.nextSegment
      ? { status: "mapped", lineNo: mappedLineNo }
      : { status: "stale", reason: "file-unavailable" };
  };
}

export function createAnchorReloadLineMapper(
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
): AnchorReloadLineMapper {
  return createAnchorSnapshotLineMapper(previous, next, false);
}

export function createAnchorAppendLineMapper(
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
): AnchorReloadLineMapper {
  return createAnchorSnapshotLineMapper(previous, next, true);
}

export function relocateAnchorLineForReload(
  lineNo: number,
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
): AnchorReloadLineResult {
  return createAnchorReloadLineMapper(previous, next)(lineNo);
}
