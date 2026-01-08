import { describe, expect, it } from "vitest";
import type { LineSegment } from "./lineNumbering";
import { formatLoadSuccessLabel, listLoadedFileNames } from "./loadMessages";

describe("formatLoadSuccessLabel", () => {
  it("formats a single file name", () => {
    const label = formatLoadSuccessLabel(["A.txt"]);
    expect(label).toBe("A.txt");
  });

  it("formats multiple file names with a Japanese middle dot", () => {
    const label = formatLoadSuccessLabel(["A.txt", "B.txt", "C.txt"]);
    expect(label).toBe("A.txt・B.txt・C.txt");
  });

  it("lists all loaded file names in segment order", () => {
    const segments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "A.txt" },
      { startLine: 3, lineCount: 1, fileIndex: 2, fileName: "B.txt" },
    ];
    const label = formatLoadSuccessLabel(listLoadedFileNames(segments));
    expect(label).toBe("A.txt・B.txt");
  });
});
