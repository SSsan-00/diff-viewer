import { describe, it, expect } from "vitest";
import { createLineNumberFormatter, type LineSegment } from "./lineNumbering";

describe("line number formatter", () => {
  it("resets line numbers per segment", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 3 },
      { startLine: 4, lineCount: 2 },
    ];
    const format = createLineNumberFormatter(segments);

    expect(format(1)).toBe("1");
    expect(format(3)).toBe("3");
    expect(format(4)).toBe("1");
    expect(format(5)).toBe("2");
  });

  it("falls back to absolute line numbers outside segments", () => {
    const segments: LineSegment[] = [{ startLine: 2, lineCount: 1 }];
    const format = createLineNumberFormatter(segments);

    expect(format(1)).toBe("1");
    expect(format(2)).toBe("1");
    expect(format(3)).toBe("3");
  });
});
