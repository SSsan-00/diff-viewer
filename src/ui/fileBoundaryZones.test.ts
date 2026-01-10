import { describe, it, expect } from "vitest";
import { diffLines } from "../diffEngine/diffLines";
import { pairReplace } from "../diffEngine/pairReplace";
import type { LineSegment } from "../file/lineNumbering";
import { buildAlignedFileBoundaryZones } from "./fileBoundaryZones";

describe("file boundary zones alignment", () => {
  it("keeps file boundary gaps aligned when file counts differ", () => {
    const leftText = ["A", "B", "C", "D"].join("\n");
    const rightText = ["A", "B"].join("\n");

    const ops = pairReplace(diffLines(leftText, rightText));

    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "fileA.txt" },
      { startLine: 3, lineCount: 2, fileIndex: 2, fileName: "fileB.txt" },
    ];
    const rightSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "fileA.txt" },
    ];

    const zones = buildAlignedFileBoundaryZones(ops, leftSegments, rightSegments, 3);

    expect(zones.left.length).toBe(1);
    expect(zones.right.length).toBe(1);
    expect(zones.left[0].afterLineNumber).toBe(zones.right[0].afterLineNumber);
    expect(zones.left[0].label).toContain("fileB.txt");
    expect(zones.right[0].label).toBeUndefined();
  });

  it("places the boundary after the previous file's last line", () => {
    const leftText = ["A1", "A2", "B1", "B2"].join("\n");
    const rightText = ["A1", "A2", "B1", "B2"].join("\n");
    const ops = pairReplace(diffLines(leftText, rightText));

    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "fileA.txt" },
      { startLine: 3, lineCount: 2, fileIndex: 2, fileName: "fileB.txt" },
    ];

    const zones = buildAlignedFileBoundaryZones(ops, leftSegments, leftSegments, 3);

    expect(zones.left[0].afterLineNumber).toBe(2);
    expect(zones.right[0].afterLineNumber).toBe(2);
  });
});
