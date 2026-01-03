import { describe, it, expect } from "vitest";
import { decodeArrayBuffer } from "./decode";

function toBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("decodeArrayBuffer", () => {
  it("throws on invalid UTF-8 when fatal is true", () => {
    const invalidUtf8 = toBuffer([0xc3, 0x28]);

    expect(() => decodeArrayBuffer(invalidUtf8, "utf-8")).toThrow();
  });

  it("decodes UTF-8 BOM in auto mode", () => {
    const utf8Bom = toBuffer([0xef, 0xbb, 0xbf, 0x61, 0x62, 0x63]);

    expect(decodeArrayBuffer(utf8Bom, "auto")).toBe("abc");
  });

  it("prompts for encoding selection when auto decoding fails", () => {
    const invalidUtf8 = toBuffer([0xc3, 0x28]);

    expect(() => decodeArrayBuffer(invalidUtf8, "auto")).toThrow(
      "文字コードを選択してください",
    );
  });
});
