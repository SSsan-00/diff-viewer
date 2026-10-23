import { describe, expect, it } from "vitest";
import type { LineSegment } from "./lineNumbering";
import { listLoadedFileNames } from "./loadMessages";

describe("listLoadedFileNames", () => {
  it("lists loaded file names in segment order and skips unnamed segments", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "A.txt" },
      { startLine: 3, lineCount: 1, fileIndex: 2 },
      { startLine: 4, lineCount: 1, fileIndex: 3, fileName: "B.txt" },
    ];
    expect(listLoadedFileNames(segments)).toEqual(["A.txt", "B.txt"]);
  });

  it("returns no names for empty input", () => {
    expect(listLoadedFileNames([])).toEqual([]);
  });
});
