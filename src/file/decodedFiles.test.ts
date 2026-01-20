import { describe, it, expect } from "vitest";
import { appendDecodedFiles, buildDecodedFiles, type FileBytes } from "./decodedFiles";
import { getLineSegmentInfo } from "./lineNumbering";

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
});
