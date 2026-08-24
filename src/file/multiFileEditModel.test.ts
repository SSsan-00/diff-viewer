import { describe, expect, it } from "vitest";
import {
  updateSegmentsForChanges,
  type LineChange,
  type LineSegment,
} from "./lineNumbering";
import { appendDecodedFiles, buildDecodedFiles } from "./decodedFiles";
import {
  areChangesWithinSingleFileSegments,
  buildMultiFileWritePlan,
  canUsePaneSaveTargets,
  extractSegmentTexts,
  isFullySegmentedText,
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

  it("keeps an unmanaged prefix outside the appended file boundary", () => {
    const prefixedSegments: LineSegment[] = [
      { startLine: 3, lineCount: 2, fileIndex: 1, fileName: "managed.txt" },
    ];

    expect(
      areChangesWithinSingleFileSegments(prefixedSegments, [
        change(1, 1, 2, 5, "changed prefix"),
      ]),
    ).toBe(true);
    expect(
      areChangesWithinSingleFileSegments(prefixedSegments, [
        change(3, 1, 4, 5, "changed file"),
      ]),
    ).toBe(true);
    expect(
      areChangesWithinSingleFileSegments(prefixedSegments, [
        change(2, 5, 3, 1, ""),
      ]),
    ).toBe(false);
  });

  it("extracts current editor text back into per-file text blocks", () => {
    expect(extractSegmentTexts("A1\nA2\nB1\nB2", segments)).toEqual([
      { fileName: "a.txt", text: "A1\nA2" },
      { fileName: "b.txt", text: "B1\nB2" },
    ]);
  });

  it("extracts only managed segments after an unmanaged prefix", () => {
    const prefixedSegments: LineSegment[] = [
      {
        startLine: 3,
        lineCount: 2,
        fileIndex: 1,
        fileName: "managed.txt",
      },
    ];

    expect(
      extractSegmentTexts(
        "unmanaged 1\nunmanaged 2\nmanaged 1\nmanaged 2",
        prefixedSegments,
      ),
    ).toEqual([{ fileName: "managed.txt", text: "managed 1\nmanaged 2" }]);
    expect(
      isFullySegmentedText(
        "unmanaged 1\nunmanaged 2\nmanaged 1\nmanaged 2",
        prefixedSegments,
      ),
    ).toBe(false);
  });

  it("never includes an unmanaged prefix in a file write plan", () => {
    const target: PaneSaveTarget = {
      handle: {
        name: "managed.txt",
        async getFile() {
          return new File([""], "managed.txt");
        },
      },
      fileName: "managed.txt",
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
      lineEnding: "\n",
    };
    const plan = buildMultiFileWritePlan(
      "unmanaged 1\nunmanaged 2\nmanaged 1\nmanaged 2",
      [
        {
          startLine: 3,
          lineCount: 2,
          fileIndex: 1,
          fileName: "managed.txt",
        },
      ],
      [target],
    );

    expect(plan[0]?.text).toBe("managed 1\nmanaged 2");
    expect(new TextDecoder().decode(plan[0]!.bytes)).toBe(
      "managed 1\nmanaged 2",
    );
  });

  it("recognizes empty and contiguous fully managed editor content", () => {
    expect(isFullySegmentedText("", [])).toBe(true);
    expect(isFullySegmentedText("A1\nA2\nB1\nB2", segments)).toBe(true);
    expect(isFullySegmentedText("unmanaged", [])).toBe(false);
  });

  it("does not attach saved handles to layouts with unmanaged gaps or suffixes", () => {
    const target = [{ fileName: "managed.txt" }];

    expect(
      canUsePaneSaveTargets(
        "managed 1\nmanaged 2",
        [
          {
            startLine: 1,
            lineCount: 2,
            fileIndex: 1,
            fileName: "managed.txt",
          },
        ],
        target,
      ),
    ).toBe(true);
    expect(
      canUsePaneSaveTargets(
        "prefix\nmanaged",
        [
          {
            startLine: 2,
            lineCount: 1,
            fileIndex: 1,
            fileName: "managed.txt",
          },
        ],
        target,
      ),
    ).toBe(false);
    expect(
      canUsePaneSaveTargets(
        "managed\nsuffix",
        [
          {
            startLine: 1,
            lineCount: 1,
            fileIndex: 1,
            fileName: "managed.txt",
          },
        ],
        target,
      ),
    ).toBe(false);
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

  it("preserves the first file trailing newline after another file is appended", () => {
    const first = buildDecodedFiles(
      [
        {
          name: "a.txt",
          bytes: new TextEncoder().encode("A1\nA2\n"),
        },
      ],
      "utf-8",
    );
    const appended = appendDecodedFiles(
      first.text,
      first.segments,
      [{ name: "b.txt", bytes: new TextEncoder().encode("B1") }],
      "utf-8",
    );
    const targets: PaneSaveTarget[] = ["a.txt", "b.txt"].map((fileName) => ({
      handle: {
        name: fileName,
        async getFile() {
          return new File([""], fileName);
        },
      },
      fileName,
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
      lineEnding: "\n",
    }));

    const plan = buildMultiFileWritePlan(
      appended.text,
      appended.segments,
      targets,
    );

    expect(appended.segments[0]?.endsWithNewline).toBe(true);
    expect(plan[0]?.text).toBe("A1\nA2\n");
    expect(new TextDecoder().decode(plan[0]!.bytes)).toBe("A1\nA2\n");
    expect(plan[1]?.text).toBe("B1");
  });

  it("preserves every trailing newline of a non-last file", () => {
    const decoded = buildDecodedFiles(
      [
        { name: "a.txt", bytes: new TextEncoder().encode("A\n\n") },
        { name: "b.txt", bytes: new TextEncoder().encode("B") },
      ],
      "utf-8",
    );
    const targets: PaneSaveTarget[] = ["a.txt", "b.txt"].map((fileName) => ({
      handle: {
        name: fileName,
        async getFile() {
          return new File([""], fileName);
        },
      },
      fileName,
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
      lineEnding: "\n",
    }));

    const plan = buildMultiFileWritePlan(
      decoded.text,
      decoded.segments,
      targets,
    );

    expect(decoded.text).toBe("A\n\nB");
    expect(plan[0]?.text).toBe("A\n\n");
    expect(new TextDecoder().decode(plan[0]!.bytes)).toBe("A\n\n");
    expect(plan[1]?.text).toBe("B");
  });

  it("preserves a trailing newline added before appending another file", () => {
    const first = buildDecodedFiles(
      [{ name: "a.txt", bytes: new TextEncoder().encode("A") }],
      "utf-8",
    );
    updateSegmentsForChanges(
      first.segments,
      [change(1, 2, 1, 2, "\n")],
      { currentText: "A\n" },
    );
    const appended = appendDecodedFiles(
      "A\n",
      first.segments,
      [{ name: "b.txt", bytes: new TextEncoder().encode("B") }],
      "utf-8",
    );
    const targets: PaneSaveTarget[] = ["a.txt", "b.txt"].map((fileName) => ({
      handle: {
        name: fileName,
        async getFile() {
          return new File([""], fileName);
        },
      },
      fileName,
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
      lineEnding: "\n",
    }));

    const plan = buildMultiFileWritePlan(
      appended.text,
      appended.segments,
      targets,
    );

    expect(appended.text).toBe("A\nB");
    expect(appended.segments[1]?.startLine).toBe(2);
    expect(plan.map((item) => item.text)).toEqual(["A\n", "B"]);
  });

  it("does not restore a trailing newline removed before appending another file", () => {
    const first = buildDecodedFiles(
      [{ name: "a.txt", bytes: new TextEncoder().encode("A\n") }],
      "utf-8",
    );
    updateSegmentsForChanges(
      first.segments,
      [change(1, 2, 2, 1, "")],
      { currentText: "A" },
    );
    const appended = appendDecodedFiles(
      "A",
      first.segments,
      [{ name: "b.txt", bytes: new TextEncoder().encode("B") }],
      "utf-8",
    );
    const targets: PaneSaveTarget[] = ["a.txt", "b.txt"].map((fileName) => ({
      handle: {
        name: fileName,
        async getFile() {
          return new File([""], fileName);
        },
      },
      fileName,
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
      lineEnding: "\n",
    }));

    const plan = buildMultiFileWritePlan(
      appended.text,
      appended.segments,
      targets,
    );

    expect(appended.text).toBe("A\nB");
    expect(appended.segments[0]?.endsWithNewline).toBe(false);
    expect(appended.segments[1]?.startLine).toBe(2);
    expect(plan.map((item) => item.text)).toEqual(["A", "B"]);
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

    const plan = buildMultiFileWritePlan("alpha\n￥\n㈱", extendedSegments, targets);

    expect(new TextDecoder().decode(plan[0].bytes)).toBe("alpha");
    expect(new TextDecoder("shift_jis").decode(plan[1].bytes)).toBe("￥");
    expect(new TextDecoder("euc-jp").decode(plan[2].bytes)).toBe("㈱");
  });

  it("rejects mixed-encoding plans instead of converting unsupported legacy characters", () => {
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

    expect(() => buildMultiFileWritePlan("alpha\n™\n㈱", extendedSegments, targets))
      .toThrow("shift_jis");
  });

  it("uses source bytes to preserve unchanged lines in each file", () => {
    const targets: PaneSaveTarget[] = [
      {
        handle: { name: "a.txt", async getFile() { return new File([""], "a.txt"); } },
        fileName: "a.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\r\n",
      },
      {
        handle: { name: "b.txt", async getFile() { return new File([""], "b.txt"); } },
        fileName: "b.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    ];
    const sourceFiles = [
      {
        name: "a.txt",
        bytes: Uint8Array.from([
          0x87, 0x9c,
          0x0d, 0x0a,
          0x6f, 0x6c, 0x64,
          0x0d, 0x0a,
          0x87, 0x9b,
        ]),
        encoding: "shift_jis" as const,
      },
      {
        name: "b.txt",
        bytes: new TextEncoder().encode("tail"),
        encoding: "utf-8" as const,
      },
    ];

    const plan = buildMultiFileWritePlan(
      "∪\nnew\n∩\ntail",
      [
        { startLine: 1, lineCount: 3, fileIndex: 1, fileName: "a.txt" },
        { startLine: 4, lineCount: 1, fileIndex: 2, fileName: "b.txt" },
      ],
      targets,
      { sourceFiles },
    );

    expect(Array.from(plan[0].bytes)).toEqual([
      0x87, 0x9c,
      0x0d, 0x0a,
      0x6e, 0x65, 0x77,
      0x0d, 0x0a,
      0x87, 0x9b,
    ]);
    expect(new TextDecoder().decode(plan[1].bytes)).toBe("tail");
  });
});
