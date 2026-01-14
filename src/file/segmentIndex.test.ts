import { describe, expect, it } from "vitest";
import { buildFileStartLineIndex, getFileStartLine } from "./segmentIndex";

describe("segment index", () => {
  it("builds a file start line index", () => {
    const segments = [
      { startLine: 1, lineCount: 3, fileIndex: 1, fileName: "a.txt" },
      { startLine: 4, lineCount: 2, fileIndex: 2, fileName: "b.txt" },
    ];

    const index = buildFileStartLineIndex(segments);
    expect(index.get("a.txt")).toBe(1);
    expect(index.get("b.txt")).toBe(4);
  });

  it("returns null when a file is missing", () => {
    const segments = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "a.txt" },
    ];

    expect(getFileStartLine(segments, "b.txt")).toBeNull();
  });

  it("uses the first occurrence when names repeat", () => {
    const segments = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "a.txt" },
      { startLine: 3, lineCount: 2, fileIndex: 2, fileName: "a.txt" },
    ];

    expect(getFileStartLine(segments, "a.txt")).toBe(1);
  });
});
