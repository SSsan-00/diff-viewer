import { describe, it, expect } from "vitest";
import { appendDecodedFiles, buildDecodedFiles, type FileBytes } from "./decodedFiles";
import { getLineSegmentInfo } from "./lineNumbering";
import {
  extractSegmentTexts,
  isFullySegmentedText,
} from "./multiFileEditModel";

function toBytes(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe("buildDecodedFiles", () => {
  it("re-decodes the same bytes with different encodings", () => {
    const files: FileBytes[] = [
      { name: "sample.txt", bytes: toBytes([0x82, 0xa0]) },
    ];
    const shift = buildDecodedFiles(files, "shift_jis").text;
    const euc = buildDecodedFiles(files, "euc-jp").text;

    expect(shift).toBe("あ");
    expect(euc).not.toBe("あ");
  });

  it("can decode mixed files with file-specific encodings", () => {
    const files: FileBytes[] = [
      { name: "sjis.txt", bytes: toBytes([0x82, 0xa0]), encoding: "shift_jis" },
      { name: "euc.txt", bytes: toBytes([0xa4, 0xa4]), encoding: "euc-jp" },
      { name: "utf8.txt", bytes: new TextEncoder().encode("utf8"), encoding: "utf-8" },
    ];

    const result = buildDecodedFiles(files, "utf-8", { preferFileEncoding: true });

    expect(result.text).toBe("あ\nい\nutf8");
  });

  it("builds segments in file order", () => {
    const files: FileBytes[] = [
      { name: "a.txt", bytes: toBytes([0x61, 0x0a, 0x62]) },
      { name: "b.txt", bytes: toBytes([0x63]) },
    ];
    const result = buildDecodedFiles(files, "utf-8");

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].fileIndex).toBe(1);
    expect(result.segments[1].fileIndex).toBe(2);
    expect(result.segments[0].fileName).toBe("a.txt");
    expect(result.segments[1].fileName).toBe("b.txt");
  });

  it("keeps an empty first file before a non-empty second file", () => {
    const result = buildDecodedFiles(
      [
        { name: "empty.txt", bytes: new Uint8Array() },
        { name: "b.txt", bytes: new TextEncoder().encode("B") },
      ],
      "utf-8",
    );

    expect(result.text).toBe("\nB");
    expect(result.segments).toEqual([
      {
        startLine: 1,
        lineCount: 1,
        fileIndex: 1,
        fileName: "empty.txt",
        endsWithNewline: false,
      },
      {
        startLine: 2,
        lineCount: 1,
        fileIndex: 2,
        fileName: "b.txt",
        endsWithNewline: false,
      },
    ]);
    expect(isFullySegmentedText(result.text, result.segments)).toBe(true);
    expect(extractSegmentTexts(result.text, result.segments)).toEqual([
      { fileName: "empty.txt", text: "" },
      { fileName: "b.txt", text: "B" },
    ]);
    expect(getLineSegmentInfo(result.segments, 1)?.localLine).toBe(1);
    expect(getLineSegmentInfo(result.segments, 2)?.localLine).toBe(1);
  });

  it("gives two empty files one logical line each", () => {
    const result = buildDecodedFiles(
      [
        { name: "empty-a.txt", bytes: new Uint8Array() },
        { name: "empty-b.txt", bytes: new Uint8Array() },
      ],
      "utf-8",
    );

    expect(result.text).toBe("\n");
    expect(result.segments.map(({ startLine, lineCount }) => ({
      startLine,
      lineCount,
    }))).toEqual([
      { startLine: 1, lineCount: 1 },
      { startLine: 2, lineCount: 1 },
    ]);
    expect(isFullySegmentedText(result.text, result.segments)).toBe(true);
    expect(extractSegmentTexts(result.text, result.segments)).toEqual([
      { fileName: "empty-a.txt", text: "" },
      { fileName: "empty-b.txt", text: "" },
    ]);
  });

  it("appends after an empty file loaded by an earlier operation", () => {
    const first = buildDecodedFiles(
      [{ name: "empty.txt", bytes: new Uint8Array() }],
      "utf-8",
    );
    const appended = appendDecodedFiles(
      first.text,
      first.segments,
      [{ name: "b.txt", bytes: new TextEncoder().encode("B") }],
      "utf-8",
    );

    expect(appended.text).toBe("\nB");
    expect(appended.segments.map(({ startLine, lineCount }) => ({
      startLine,
      lineCount,
    }))).toEqual([
      { startLine: 1, lineCount: 1 },
      { startLine: 2, lineCount: 1 },
    ]);
    expect(isFullySegmentedText(appended.text, appended.segments)).toBe(true);
    expect(extractSegmentTexts(appended.text, appended.segments)).toEqual([
      { fileName: "empty.txt", text: "" },
      { fileName: "b.txt", text: "B" },
    ]);
  });

  it("does not reuse logical lines occupied by multiple empty files", () => {
    const emptyFiles = buildDecodedFiles(
      [
        { name: "empty-a.txt", bytes: new Uint8Array() },
        { name: "empty-b.txt", bytes: new Uint8Array() },
      ],
      "utf-8",
    );
    const appended = appendDecodedFiles(
      emptyFiles.text,
      emptyFiles.segments,
      [{ name: "c.txt", bytes: new TextEncoder().encode("C") }],
      "utf-8",
    );

    expect(appended.text).toBe("\n\nC");
    expect(appended.segments.map((segment) => segment.startLine)).toEqual([
      1, 2, 3,
    ]);
    expect(isFullySegmentedText(appended.text, appended.segments)).toBe(true);
    expect(extractSegmentTexts(appended.text, appended.segments)).toEqual([
      { fileName: "empty-a.txt", text: "" },
      { fileName: "empty-b.txt", text: "" },
      { fileName: "c.txt", text: "C" },
    ]);
  });

  it("keeps the next file's first line at the segment start (no trailing newline)", () => {
    const files: FileBytes[] = [
      { name: "a.txt", bytes: toBytes([0x41, 0x31, 0x0a, 0x41, 0x32]) },
      { name: "b.txt", bytes: toBytes([0x42, 0x31, 0x0a, 0x42, 0x32]) },
    ];
    const result = buildDecodedFiles(files, "utf-8");
    const lines = result.text.split("\n");
    const secondSegment = result.segments[1];

    expect(lines[secondSegment.startLine - 1]).toBe("B1");
    const info = getLineSegmentInfo(result.segments, secondSegment.startLine);
    expect(info?.fileIndex).toBe(2);
    expect(info?.localLine).toBe(1);
  });

  it("keeps the next file's first line at the segment start (trailing newline)", () => {
    const files: FileBytes[] = [
      { name: "a.txt", bytes: toBytes([0x41, 0x31, 0x0a, 0x41, 0x32, 0x0a]) },
      { name: "b.txt", bytes: toBytes([0x42, 0x31, 0x0a, 0x42, 0x32]) },
    ];
    const result = buildDecodedFiles(files, "utf-8");
    const lines = result.text.split("\n");
    const secondSegment = result.segments[1];

    expect(lines[secondSegment.startLine - 1]).toBe("B1");
    const info = getLineSegmentInfo(result.segments, secondSegment.startLine);
    expect(info?.fileIndex).toBe(2);
    expect(info?.localLine).toBe(1);
  });

  it("keeps the next file's first line at the segment start on append", () => {
    const first = buildDecodedFiles(
      [{ name: "a.txt", bytes: toBytes([0x41, 0x31, 0x0a, 0x41, 0x32, 0x0a]) }],
      "utf-8",
    );
    const appended = appendDecodedFiles(
      first.text,
      first.segments,
      [{ name: "b.txt", bytes: toBytes([0x42, 0x31, 0x0a, 0x42, 0x32]) }],
      "utf-8",
    );
    const lines = appended.text.split("\n");
    const secondSegment = appended.segments[1];

    expect(lines[secondSegment.startLine - 1]).toBe("B1");
    const info = getLineSegmentInfo(appended.segments, secondSegment.startLine);
    expect(info?.fileIndex).toBe(2);
    expect(info?.localLine).toBe(1);
  });

  it("starts an appended file after non-empty unsegmented text", () => {
    const appended = appendDecodedFiles(
      "unmanaged 1\nunmanaged 2",
      [],
      [{ name: "managed.txt", bytes: new TextEncoder().encode("M1\nM2") }],
      "utf-8",
    );

    expect(appended.text).toBe("unmanaged 1\nunmanaged 2\nM1\nM2");
    expect(appended.segments).toEqual([
      {
        startLine: 3,
        lineCount: 2,
        fileIndex: 1,
        fileName: "managed.txt",
        endsWithNewline: false,
      },
    ]);
    expect(getLineSegmentInfo(appended.segments, 2)).toBeNull();
    expect(getLineSegmentInfo(appended.segments, 3)).toEqual({
      fileIndex: 1,
      fileName: "managed.txt",
      localLine: 1,
    });
  });

  it("reuses only the trailing empty model line of unsegmented text", () => {
    const appended = appendDecodedFiles(
      "unmanaged 1\nunmanaged 2\n",
      [],
      [{ name: "managed.txt", bytes: new TextEncoder().encode("M1") }],
      "utf-8",
    );

    expect(appended.text).toBe("unmanaged 1\nunmanaged 2\nM1");
    expect(appended.segments[0]?.startLine).toBe(3);
    expect(getLineSegmentInfo(appended.segments, 2)).toBeNull();
    expect(getLineSegmentInfo(appended.segments, 3)?.localLine).toBe(1);
  });

  it("starts after unmanaged suffix text even when earlier segments exist", () => {
    const appended = appendDecodedFiles(
      "managed\nunmanaged suffix",
      [
        {
          startLine: 1,
          lineCount: 1,
          fileIndex: 1,
          fileName: "first.txt",
        },
      ],
      [{ name: "second.txt", bytes: new TextEncoder().encode("second") }],
      "utf-8",
    );

    expect(appended.text).toBe("managed\nunmanaged suffix\nsecond");
    expect(appended.segments[1]?.startLine).toBe(3);
    expect(getLineSegmentInfo(appended.segments, 2)).toBeNull();
    expect(getLineSegmentInfo(appended.segments, 3)?.fileName).toBe("second.txt");
  });

  it("counts the trailing newline on the last file to match model lines", () => {
    const files: FileBytes[] = [
      { name: "a.txt", bytes: toBytes([0x41, 0x31, 0x0a, 0x41, 0x32, 0x0a]) },
      { name: "b.txt", bytes: toBytes([0x42, 0x31, 0x0a, 0x42, 0x32, 0x0a]) },
    ];
    const result = buildDecodedFiles(files, "utf-8");
    const totalLines = result.text.split("\n").length;
    const segmentLines = result.segments.reduce((sum, segment) => sum + segment.lineCount, 0);

    expect(segmentLines).toBe(totalLines);
  });

  it("keeps segment line counts aligned after append when the last file ends with newline", () => {
    const first = buildDecodedFiles(
      [{ name: "a.txt", bytes: toBytes([0x41, 0x31, 0x0a, 0x41, 0x32, 0x0a]) }],
      "utf-8",
    );
    const appended = appendDecodedFiles(
      first.text,
      first.segments,
      [{ name: "b.txt", bytes: toBytes([0x42, 0x31, 0x0a, 0x42, 0x32, 0x0a]) }],
      "utf-8",
    );
    const totalLines = appended.text.split("\n").length;
    const segmentLines = appended.segments.reduce((sum, segment) => sum + segment.lineCount, 0);

    expect(segmentLines).toBe(totalLines);
  });

  it("round-trips empty and newline-heavy file combinations through segments", () => {
    const values = ["", "A", "A\n", "\n", "A\n\n", "\n\n"];
    const cases = [
      ...values.flatMap((first) =>
        values.map((second) => [first, second]),
      ),
      ...values.flatMap((first) =>
        values.flatMap((second) =>
          values.map((third) => [first, second, third]),
        ),
      ),
    ];

    for (const [caseIndex, texts] of cases.entries()) {
      const files = texts.map((text, index) => ({
        name: `${caseIndex}-${index}.txt`,
        bytes: new TextEncoder().encode(text),
      }));
      const result = buildDecodedFiles(files, "utf-8");

      expect(isFullySegmentedText(result.text, result.segments)).toBe(true);
      expect(extractSegmentTexts(result.text, result.segments)).toEqual(
        texts.map((text, index) => ({
          fileName: `${caseIndex}-${index}.txt`,
          text,
        })),
      );
    }
  });
});
