import { normalizeText } from "../diffEngine/normalize";
import type { LineSegment } from "../file/lineNumbering";
import type {
  AnchorReloadLineMapper,
  AnchorReloadPaneSnapshot,
} from "./anchorReload";

type SegmentBounds = Readonly<{
  start: number;
  end: number;
}>;

type PreparedEncodingSegment =
  | { status: "unavailable" }
  | {
      status: "ready";
      previousBounds: SegmentBounds;
      nextBounds: SegmentBounds;
      nextSegment: LineSegment;
    };

function segmentKey(segment: LineSegment): string {
  return JSON.stringify([segment.fileIndex, segment.fileName ?? null]);
}

function segmentBounds(
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

function buildLineSegmentIndex(
  segments: readonly LineSegment[],
  lineCount: number,
): Array<LineSegment | null | undefined> {
  const index = new Array<LineSegment | null | undefined>(lineCount);
  segments.forEach((segment) => {
    const bounds = segmentBounds(segment, lineCount);
    if (!bounds) {
      return;
    }
    for (let lineNo = bounds.start; lineNo < bounds.end; lineNo += 1) {
      index[lineNo] = index[lineNo] === undefined ? segment : null;
    }
  });
  return index;
}

function groupSegments(
  segments: readonly LineSegment[],
): Map<string, LineSegment[]> {
  const result = new Map<string, LineSegment[]>();
  segments.forEach((segment) => {
    const key = segmentKey(segment);
    const group = result.get(key) ?? [];
    group.push(segment);
    result.set(key, group);
  });
  return result;
}

export function createAnchorEncodingLineMapper(
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
): AnchorReloadLineMapper {
  const previousLineCount = normalizeText(previous.text).split("\n").length;
  const nextLineCount = normalizeText(next.text).split("\n").length;
  const previousIndex = buildLineSegmentIndex(
    previous.segments,
    previousLineCount,
  );
  const nextIndex = buildLineSegmentIndex(next.segments, nextLineCount);
  const previousGroups = groupSegments(previous.segments);
  const nextGroups = groupSegments(next.segments);
  const prepared = new Map<LineSegment, PreparedEncodingSegment>();

  previous.segments.forEach((previousSegment) => {
    const previousMatches = previousGroups.get(segmentKey(previousSegment)) ?? [];
    const nextMatches = nextGroups.get(segmentKey(previousSegment)) ?? [];
    const nextSegment = nextMatches[0];
    const previousBounds = segmentBounds(previousSegment, previousLineCount);
    const nextBounds = nextSegment
      ? segmentBounds(nextSegment, nextLineCount)
      : null;
    if (
      previousMatches.length !== 1 ||
      nextMatches.length !== 1 ||
      previousSegment.lineCount !== nextSegment?.lineCount ||
      !previousBounds ||
      !nextSegment ||
      !nextBounds
    ) {
      prepared.set(previousSegment, { status: "unavailable" });
      return;
    }
    prepared.set(previousSegment, {
      status: "ready",
      previousBounds,
      nextBounds,
      nextSegment,
    });
  });

  return (lineNo) => {
    if (!Number.isInteger(lineNo) || lineNo < 0 || lineNo >= previousLineCount) {
      return { status: "stale", reason: "line-out-of-range" };
    }
    const previousSegment = previousIndex[lineNo];
    if (!previousSegment) {
      return {
        status: "stale",
        reason: previousSegment === null ? "file-unavailable" : "line-out-of-range",
      };
    }
    const mapping = prepared.get(previousSegment);
    if (!mapping || mapping.status === "unavailable") {
      return { status: "stale", reason: "file-unavailable" };
    }
    const localLineNo = lineNo - mapping.previousBounds.start;
    const mappedLineNo = mapping.nextBounds.start + localLineNo;
    return nextIndex[mappedLineNo] === mapping.nextSegment
      ? { status: "mapped", lineNo: mappedLineNo }
      : { status: "stale", reason: "file-unavailable" };
  };
}
