import { describe, expect, it } from "vitest";
import type { LineChange, LineSegment } from "./lineNumbering";
import {
  areChangesWithinSingleFileSegments,
  buildMultiFileWritePlan,
  extractSegmentTexts,
} from "./multiFileEditModel";
import type { PaneSaveTarget } from "./writeback";

function change(
  startLineNumber: number,
  startColumn: number,
  endLineNumber: number,
  endColumn: number,
  text: string,
): LineChange {
  return {
    range: {
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
    },
    text,
  };
}

describe("multi-file edit model", () => {
  const segments: LineSegment[] = [
    { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "a.txt" },
    { startLine: 3, lineCount: 2, fileIndex: 2, fileName: "b.txt" },
  ];

  it("allows edits that stay inside one file segment", () => {
    expect(
      areChangesWithinSingleFileSegments(segments, [
        change(2, 1, 2, 3, "A2 edited"),
      ]),
    ).toBe(true);
  });

  it("rejects edits that cross file boundaries", () => {
    expect(
      areChangesWithinSingleFileSegments(segments, [
        change(2, 3, 3, 1, ""),
      ]),
    ).toBe(false);
  });

  it("extracts current editor text back into per-file text blocks", () => {
    expect(extractSegmentTexts("A1\nA2\nB1\nB2", segments)).toEqual([
      { fileName: "a.txt", text: "A1\nA2" },
      { fileName: "b.txt", text: "B1\nB2" },
    ]);
  });

  it("preserves a non-last file trailing newline when the segment records it", () => {
    expect(
      extractSegmentTexts("A1\nA2\nB1", [
        {
          startLine: 1,
          lineCount: 2,
          fileIndex: 1,
          fileName: "a.txt",
          endsWithNewline: true,
        },
        { startLine: 3, lineCount: 1, fileIndex: 2, fileName: "b.txt" },
      ]),
    ).toEqual([
      { fileName: "a.txt", text: "A1\nA2\n" },
      { fileName: "b.txt", text: "B1" },
    ]);
  });

  it("builds write plans for every file before any file is written", () => {
    const targets: PaneSaveTarget[] = [
      {
        handle: { name: "a.txt", async getFile() { return new File([""], "a.txt"); } },
        fileName: "a.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
      {
        handle: { name: "b.txt", async getFile() { return new File([""], "b.txt"); } },
        fileName: "b.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\r\n",
      },
    ];

    const plan = buildMultiFileWritePlan("A1\nA2\nあ\nｲ", segments, targets);

    expect(plan.map((item) => item.text)).toEqual(["A1\nA2", "あ\nｲ"]);
    expect(Array.from(plan[1].bytes)).toEqual([0x82, 0xa0, 0x0d, 0x0a, 0xb2]);
  });

  it("rejects a write plan before writing when any file cannot be encoded", () => {
    const targets: PaneSaveTarget[] = [
      {
        handle: { name: "a.txt", async getFile() { return new File([""], "a.txt"); } },
        fileName: "a.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
      {
        handle: { name: "b.txt", async getFile() { return new File([""], "b.txt"); } },
        fileName: "b.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    ];

    expect(() => buildMultiFileWritePlan("A1\nA2\n🙂", segments, targets))
      .toThrow("shift_jis");
  });

  it("builds mixed-encoding plans per file without losing directly representable legacy characters", () => {
    const extendedSegments: LineSegment[] = [
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "a.txt" },
      { startLine: 2, lineCount: 1, fileIndex: 2, fileName: "b.txt" },
      { startLine: 3, lineCount: 1, fileIndex: 3, fileName: "c.txt" },
    ];
    const targets: PaneSaveTarget[] = [
      {
        handle: { name: "a.txt", async getFile() { return new File([""], "a.txt"); } },
        fileName: "a.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
      {
        handle: { name: "b.txt", async getFile() { return new File([""], "b.txt"); } },
        fileName: "b.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
      {
        handle: { name: "c.txt", async getFile() { return new File([""], "c.txt"); } },
        fileName: "c.txt",
        resolvedEncoding: "euc-jp",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    ];

    const plan = buildMultiFileWritePlan("alpha\n™\n㈱", extendedSegments, targets);

    expect(new TextDecoder().decode(plan[0].bytes)).toBe("alpha");
    expect(new TextDecoder("shift_jis").decode(plan[1].bytes)).toBe("TM");
    expect(new TextDecoder("euc-jp").decode(plan[2].bytes)).toBe("㈱");
  });
});
