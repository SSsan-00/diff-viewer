import { describe, it, expect } from "vitest";
import type { LineSegment } from "./lineNumbering";
import { normalizeLastSegmentForAppend } from "./segmentAppend";

describe("normalizeLastSegmentForAppend", () => {
  it("trims trailing newline lines when the last segment flag is missing", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 3, fileIndex: 1 },
    ];

    normalizeLastSegmentForAppend(segments, "A1\nA2_LAST\n");

    expect(segments[0].lineCount).toBe(2);
    expect(segments[0].endsWithNewline).toBe(false);
  });

  it("does nothing when the current value does not end with a newline", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];

    normalizeLastSegmentForAppend(segments, "A1\nA2_LAST");

    expect(segments[0].lineCount).toBe(2);
    expect(segments[0].endsWithNewline).toBeUndefined();
  });

  it("does not double-trim when the line count is already logical", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, endsWithNewline: true },
    ];

    normalizeLastSegmentForAppend(segments, "A1\nA2\n");

    expect(segments[0].lineCount).toBe(2);
    expect(segments[0].endsWithNewline).toBe(true);
  });
});
