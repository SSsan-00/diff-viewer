import { describe, it, expect } from "vitest";
import {
  createLineNumberFormatter,
  getLineSegmentInfo,
  type LineSegment,
} from "./lineNumbering";

describe("line number formatter", () => {
  it("resets line numbers per segment", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 3, fileIndex: 1 },
      { startLine: 4, lineCount: 2, fileIndex: 2 },
    ];
    const format = createLineNumberFormatter(segments);

    expect(format(1)).toBe("1");
    expect(format(3)).toBe("3");
    expect(format(4)).toBe("1");
    expect(format(5)).toBe("2");
  });

  it("falls back to absolute line numbers outside segments", () => {
    const segments: LineSegment[] = [{ startLine: 2, lineCount: 1, fileIndex: 1 }];
    const format = createLineNumberFormatter(segments);

    expect(format(1)).toBe("1");
    expect(format(2)).toBe("1");
    expect(format(3)).toBe("3");
  });

  it("returns file-local info when a line is inside a segment", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "alpha.txt" },
      { startLine: 3, lineCount: 3, fileIndex: 2, fileName: "beta.txt" },
    ];

    const info = getLineSegmentInfo(segments, 4);
    expect(info).toEqual({ fileIndex: 2, fileName: "beta.txt", localLine: 2 });
  });

  it("returns null when a line is outside any segment", () => {
    const segments: LineSegment[] = [{ startLine: 3, lineCount: 2, fileIndex: 1 }];

    expect(getLineSegmentInfo(segments, 1)).toBeNull();
  });
});
