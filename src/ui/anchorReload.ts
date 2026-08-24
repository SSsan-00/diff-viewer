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
