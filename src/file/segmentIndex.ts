import type { LineSegment } from "./lineNumbering";

export function buildFileStartLineIndex(
  segments: readonly LineSegment[],
): Map<string, number> {
  const index = new Map<string, number>();
  for (const segment of segments) {
    if (!segment.fileName) {
      continue;
    }
    if (!index.has(segment.fileName)) {
      index.set(segment.fileName, segment.startLine);
    }
  }
  return index;
}

export function getFileStartLine(
  segments: readonly LineSegment[],
  fileName: string,
): number | null {
  return buildFileStartLineIndex(segments).get(fileName) ?? null;
}

export function getFileSegment(
  segments: readonly LineSegment[],
  fileName: string,
): LineSegment | null {
  for (const segment of segments) {
    if (segment.fileName === fileName) {
      return segment;
    }
  }
  return null;
}

export function getGlobalLineFromLocal(
  segments: readonly LineSegment[],
  fileName: string,
  localLine: number,
): number | null {
  const segment = getFileSegment(segments, fileName);
  if (!segment) {
    return null;
  }
  return segment.startLine + localLine - 1;
}
