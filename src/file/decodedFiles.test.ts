import { describe, it, expect } from "vitest";
import { buildDecodedFiles, type FileBytes } from "./decodedFiles";

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
});
