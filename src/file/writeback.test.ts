import { describe, expect, it } from "vitest";
import {
  collectDroppedFiles,
  describeDecodedFileForWriteback,
  encodeUtf8TextForWriteback,
  getPaneWriteAvailability,
  saveTextWithPaneTarget,
  writeTextToFileHandle,
} from "./writeback";

function toBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("describeDecodedFileForWriteback", () => {
  it("detects UTF-8 BOM and CRLF endings", () => {
    const meta = describeDecodedFileForWriteback(
      toBuffer([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62]),
      "auto",
    );

    expect(meta.resolvedEncoding).toBe("utf-8");
    expect(meta.includeUtf8Bom).toBe(true);
    expect(meta.lineEnding).toBe("\r\n");
  });

  it("detects Shift_JIS when auto-decoding falls back from UTF-8", () => {
    const meta = describeDecodedFileForWriteback(toBuffer([0x82, 0xa0]), "auto");

    expect(meta.resolvedEncoding).toBe("shift_jis");
    expect(meta.includeUtf8Bom).toBe(false);
    expect(meta.lineEnding).toBe("\n");
  });
});

describe("encodeUtf8TextForWriteback", () => {
  it("preserves BOM and restores CRLF endings", () => {
    const bytes = encodeUtf8TextForWriteback("a\nb", {
      includeUtf8Bom: true,
      lineEnding: "\r\n",
    });

    expect(Array.from(bytes)).toEqual([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62]);
  });
});

describe("getPaneWriteAvailability", () => {
  it("enables save for single files opened with a writable handle", () => {
    const availability = getPaneWriteAvailability({
      hasFileSystemAccess: true,
      fileCount: 1,
      selectedEncoding: "auto",
      target: {
        handle: { name: "left.txt" },
        fileName: "left.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    });

    expect(availability.enabled).toBe(true);
    expect(availability.reason).toBeNull();
  });

  it("disables save for multi-file panes", () => {
    const availability = getPaneWriteAvailability({
      hasFileSystemAccess: true,
      fileCount: 2,
      selectedEncoding: "utf-8",
      target: null,
    });

    expect(availability.enabled).toBe(false);
    expect(availability.reason).toContain("単一ファイル比較");
  });

  it("enables save for Shift_JIS targets when the displayed encoding matches", () => {
    const availability = getPaneWriteAvailability({
      hasFileSystemAccess: true,
      fileCount: 1,
      selectedEncoding: "auto",
      target: {
        handle: { name: "left.txt" },
        fileName: "left.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    });

    expect(availability.enabled).toBe(true);
    expect(availability.reason).toBeNull();
  });

  it("disables save when the displayed encoding differs from the source encoding", () => {
    const availability = getPaneWriteAvailability({
      hasFileSystemAccess: true,
      fileCount: 1,
      selectedEncoding: "euc-jp",
      target: {
        handle: { name: "left.txt" },
        fileName: "left.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    });

    expect(availability.enabled).toBe(false);
    expect(availability.reason).toContain("元の文字コード");
  });
});

describe("collectDroppedFiles", () => {
  it("preserves writable handles for dropped files when the browser exposes them", async () => {
    const file = new File(["a"], "left.txt", { type: "text/plain" });
    const handle = {
      kind: "file",
      name: "left.txt",
      async getFile() {
        return file;
      },
      async createWritable() {
        return {
          async write(_data: BufferSource) {
            return undefined;
          },
          async close() {
            return undefined;
          },
        };
      },
    };

    const dropped = await collectDroppedFiles({
      items: [
        {
          kind: "file",
          getAsFile: () => file,
          getAsFileSystemHandle: async () => handle,
        },
      ],
      files: [file],
    });

    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.file).toBe(file);
    expect(dropped[0]?.handle).toBe(handle);
  });

  it("falls back to dropped files when no writable handle is available", async () => {
    const file = new File(["a"], "left.txt", { type: "text/plain" });

    const dropped = await collectDroppedFiles({
      items: [
        {
          kind: "file",
          getAsFile: () => file,
        },
      ],
      files: [file],
    });

    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.file).toBe(file);
    expect(dropped[0]?.handle).toBeNull();
  });
});

describe("writeTextToFileHandle", () => {
  it("writes UTF-8 bytes to the file handle", async () => {
    const written: number[] = [];
    let closed = false;
    const handle = {
      name: "left.txt",
      async createWritable() {
        return {
          async write(data: BufferSource) {
            written.push(...Array.from(new Uint8Array(data as ArrayBufferLike)));
          },
          async close() {
            closed = true;
          },
        };
      },
    };

    await writeTextToFileHandle(handle, "a\nb", {
      resolvedEncoding: "utf-8",
      includeUtf8Bom: true,
      lineEnding: "\r\n",
    });

    expect(written).toEqual([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62]);
    expect(closed).toBe(true);
  });

  it("writes Shift_JIS bytes to the file handle", async () => {
    const written: number[] = [];
    const handle = {
      name: "left.txt",
      async createWritable() {
        return {
          async write(data: BufferSource) {
            written.push(...Array.from(new Uint8Array(data as ArrayBufferLike)));
          },
          async close() {
            return undefined;
          },
        };
      },
    };

    await writeTextToFileHandle(handle, "あ\nｲ", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\r\n",
    });

    expect(written).toEqual([0x82, 0xa0, 0x0d, 0x0a, 0xb2]);
  });

  it("writes EUC-JP bytes to the file handle", async () => {
    const written: number[] = [];
    const handle = {
      name: "right.txt",
      async createWritable() {
        return {
          async write(data: BufferSource) {
            written.push(...Array.from(new Uint8Array(data as ArrayBufferLike)));
          },
          async close() {
            return undefined;
          },
        };
      },
    };

    await writeTextToFileHandle(handle, "あ\nい", {
      resolvedEncoding: "euc-jp",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(written).toEqual([0xa4, 0xa2, 0x0a, 0xa4, 0xa4]);
  });

  it("throws when the text cannot be represented in the target encoding", async () => {
    const handle = {
      name: "left.txt",
      async createWritable() {
        return {
          async write(_data: BufferSource) {
            return undefined;
          },
          async close() {
            return undefined;
          },
        };
      },
    };

    await expect(
      writeTextToFileHandle(handle, "🙂", {
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      }),
    ).rejects.toThrow("shift_jis");
  });
});

describe("saveTextWithPaneTarget", () => {
  it("preserves UTF-8 BOM and CRLF on the save-button path", async () => {
    const original = toBuffer([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62]);
    const targetMeta = describeDecodedFileForWriteback(original, "auto");
    const written: number[] = [];

    await saveTextWithPaneTarget(
      {
        handle: {
          name: "utf8.txt",
          async createWritable() {
            return {
              async write(data: BufferSource) {
                written.push(...Array.from(new Uint8Array(data as ArrayBufferLike)));
              },
              async close() {
                return undefined;
              },
            };
          },
        },
        fileName: "utf8.txt",
        ...targetMeta,
      },
      "a\nb",
    );

    expect(written).toEqual([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62]);
  });

  it("preserves Shift_JIS bytes on the save-button path", async () => {
    const original = toBuffer([0x82, 0xa0, 0x0d, 0x0a, 0xb2]);
    const targetMeta = describeDecodedFileForWriteback(original, "shift_jis");
    const written: number[] = [];

    await saveTextWithPaneTarget(
      {
        handle: {
          name: "sjis.txt",
          async createWritable() {
            return {
              async write(data: BufferSource) {
                written.push(...Array.from(new Uint8Array(data as ArrayBufferLike)));
              },
              async close() {
                return undefined;
              },
            };
          },
        },
        fileName: "sjis.txt",
        ...targetMeta,
      },
      "あ\nｲ",
    );

    expect(written).toEqual([0x82, 0xa0, 0x0d, 0x0a, 0xb2]);
  });

  it("preserves EUC-JP bytes on the save-button path", async () => {
    const original = toBuffer([0xa4, 0xa2, 0x0a, 0xa4, 0xa4]);
    const targetMeta = describeDecodedFileForWriteback(original, "euc-jp");
    const written: number[] = [];

    await saveTextWithPaneTarget(
      {
        handle: {
          name: "euc.txt",
          async createWritable() {
            return {
              async write(data: BufferSource) {
                written.push(...Array.from(new Uint8Array(data as ArrayBufferLike)));
              },
              async close() {
                return undefined;
              },
            };
          },
        },
        fileName: "euc.txt",
        ...targetMeta,
      },
      "あ\nい",
    );

    expect(written).toEqual([0xa4, 0xa2, 0x0a, 0xa4, 0xa4]);
  });
});
