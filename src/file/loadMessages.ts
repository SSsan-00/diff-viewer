import type { LineSegment } from "./lineNumbering";

export function listLoadedFileNames(segments: readonly LineSegment[]): string[] {
  const names: string[] = [];
  for (const segment of segments) {
    if (segment.fileName && segment.fileName.length > 0) {
      names.push(segment.fileName);
    }
  }
  return names;
}
