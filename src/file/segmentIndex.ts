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
