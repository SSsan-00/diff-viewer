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

  it("falls back to Shift_JIS when UTF-8 strict decoding fails", () => {
    const shiftJisBytes = toBuffer([0x82, 0xa0]);

    expect(decodeArrayBuffer(shiftJisBytes, "auto")).toBe("あ");
  });

  it("decodes EUC-JP when auto detects better Japanese text", () => {
    const eucJpBytes = toBuffer([0xa4, 0xa2]);

    expect(decodeArrayBuffer(eucJpBytes, "auto")).toBe("あ");
  });

  it("uses UTF-8 when auto decoding succeeds", () => {
    const utf8Bytes = toBuffer([0x68, 0x69]);

    expect(decodeArrayBuffer(utf8Bytes, "auto")).toBe("hi");
  });
});
