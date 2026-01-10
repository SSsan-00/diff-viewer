import type { LineSegment } from "./lineNumbering";

export function normalizeLastSegmentForAppend(
  segments: LineSegment[],
  currentValue: string,
): void {
  if (segments.length === 0) {
    return;
  }
  const lastSegment = segments[segments.length - 1];
  const effectiveEndsWithNewline =
    lastSegment.endsWithNewline ?? currentValue.endsWith("\n");
  if (!effectiveEndsWithNewline) {
    return;
  }
  const totalLineCount = currentValue.split("\n").length;
  const physicalCount = totalLineCount - lastSegment.startLine + 1;
  if (lastSegment.lineCount !== physicalCount || physicalCount <= 1) {
    return;
  }
  lastSegment.lineCount = physicalCount - 1;
  lastSegment.endsWithNewline = false;
}
