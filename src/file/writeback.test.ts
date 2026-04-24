import { describe, expect, it } from "vitest";
import {
  buildPaneWriteBytes,
  collectDroppedFiles,
  describeDecodedFileForWriteback,
  encodeUtf8TextForWriteback,
  getPaneWriteAvailability,
  pickFilesWithHandles,
  readCurrentFileFromPaneTarget,
  resolveReloadEncodingForPaneTarget,
  requestFileHandlePermission,
  saveTextWithPaneTarget,
  writeBytesToFileHandle,
  writeTextToFileHandle,
} from "./writeback";

function toBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function collectDirectLegacyCharacters(
  encoding: "shift_jis" | "euc-jp",
): string[] {
  const decoder = new TextDecoder(encoding);
  const chars = new Set<string>();
  const register = (bytes: number[]) => {
    const decoded = decoder.decode(Uint8Array.from(bytes));
    if (decoded.includes("\uFFFD")) {
      return;
    }
    const values = Array.from(decoded);
    if (values.length !== 1) {
      return;
    }
    chars.add(values[0] ?? "");
  };

  if (encoding === "shift_jis") {
    for (let byte = 0x00; byte <= 0x7f; byte += 1) {
      register([byte]);
    }
    for (let byte = 0xa1; byte <= 0xdf; byte += 1) {
      register([byte]);
    }
    const trailBytes: number[] = [];
    for (let byte = 0x40; byte <= 0x7e; byte += 1) {
      trailBytes.push(byte);
    }
    for (let byte = 0x80; byte <= 0xfc; byte += 1) {
      trailBytes.push(byte);
    }
    for (let lead = 0x81; lead <= 0x9f; lead += 1) {
      for (const trail of trailBytes) {
        register([lead, trail]);
      }
    }
    for (let lead = 0xe0; lead <= 0xfc; lead += 1) {
      for (const trail of trailBytes) {
        register([lead, trail]);
      }
    }
    return [...chars];
  }

  for (let byte = 0x00; byte <= 0x7f; byte += 1) {
    register([byte]);
  }
  for (let byte = 0xa1; byte <= 0xdf; byte += 1) {
    register([0x8e, byte]);
  }
  for (let lead = 0xa1; lead <= 0xfe; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      register([lead, trail]);
    }
  }
  for (let lead = 0xa1; lead <= 0xfe; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      register([0x8f, lead, trail]);
    }
  }
  return [...chars];
}

function createWritableHandle(name: string) {
  return {
    name,
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
        handle: createWritableHandle("left.txt"),
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
        handle: createWritableHandle("left.txt"),
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
        handle: createWritableHandle("left.txt"),
        fileName: "left.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    });

    expect(availability.enabled).toBe(false);
    expect(availability.reason).toContain("元の文字コード");
  });

  it("disables save for readable handles that cannot create a writable stream", () => {
    const availability = getPaneWriteAvailability({
      hasFileSystemAccess: true,
      fileCount: 1,
      selectedEncoding: "auto",
      target: {
        handle: {
          name: "read-only.txt",
          async getFile() {
            return new File(["a"], "read-only.txt");
          },
        },
        fileName: "read-only.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
    });

    expect(availability.enabled).toBe(false);
    expect(availability.reason).toContain("保存用");
  });
});

describe("requestFileHandlePermission", () => {
  it("requests readwrite permission when the restored handle is only promptable", async () => {
    const calls: string[] = [];
    const handle = {
      async queryPermission(descriptor: { mode?: string }) {
        calls.push(`query:${descriptor.mode}`);
        return "prompt" as PermissionState;
      },
      async requestPermission(descriptor: { mode?: string }) {
        calls.push(`request:${descriptor.mode}`);
        return "granted" as PermissionState;
      },
    };

    await expect(requestFileHandlePermission(handle, "readwrite")).resolves.toBe(true);
    expect(calls).toEqual(["query:readwrite", "request:readwrite"]);
  });

  it("does not request permission when it is already granted", async () => {
    const calls: string[] = [];
    const handle = {
      async queryPermission(descriptor: { mode?: string }) {
        calls.push(`query:${descriptor.mode}`);
        return "granted" as PermissionState;
      },
      async requestPermission(descriptor: { mode?: string }) {
        calls.push(`request:${descriptor.mode}`);
        return "denied" as PermissionState;
      },
    };

    await expect(requestFileHandlePermission(handle, "read")).resolves.toBe(true);
    expect(calls).toEqual(["query:read"]);
  });
});

describe("collectDroppedFiles", () => {
  it("preserves readable handles for dropped files even when they are not writable", async () => {
    const file = new File(["a"], "read-only.txt", { type: "text/plain" });
    const handle = {
      kind: "file",
      name: "read-only.txt",
      async getFile() {
        return file;
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

describe("pickFilesWithHandles", () => {
  it("accepts readable file handles without requiring write capability", async () => {
    const file = new File(["a"], "read-only.txt", { type: "text/plain" });
    const handle = {
      name: "read-only.txt",
      async getFile() {
        return file;
      },
    };

    const picked = await pickFilesWithHandles({
      async showOpenFilePicker() {
        return [handle];
      },
    });

    expect(picked.files).toEqual([file]);
    expect(picked.handles).toEqual([handle]);
  });
});

describe("writeTextToFileHandle", () => {
  it("builds write bytes without touching the file handle", () => {
    const bytes = buildPaneWriteBytes("あ\nｲ", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\r\n",
    });

    expect(Array.from(bytes)).toEqual([0x82, 0xa0, 0x0d, 0x0a, 0xb2]);
  });

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

  it("writes prebuilt bytes without re-encoding them", async () => {
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

    await writeBytesToFileHandle(handle, Uint8Array.from([0x82, 0xa0]));

    expect(written).toEqual([0x82, 0xa0]);
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

  it("encodes common Unicode compatibility characters to Shift_JIS bytes", () => {
    const bytes = buildPaneWriteBytes("¥‾¢£¬〜−‖—", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(Array.from(bytes)).toEqual([
      0x5c,
      0x7e,
      0x81, 0x91,
      0x81, 0x92,
      0x81, 0xca,
      0x81, 0x60,
      0x81, 0x7c,
      0x81, 0x61,
      0x81, 0x5c,
    ]);
  });

  it("encodes common Unicode compatibility characters to EUC-JP bytes", () => {
    const bytes = buildPaneWriteBytes("¥‾¢£¬〜−‖—", {
      resolvedEncoding: "euc-jp",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(Array.from(bytes)).toEqual([
      0x5c,
      0x7e,
      0xa1, 0xf1,
      0xa1, 0xf2,
      0xa2, 0xcc,
      0xa1, 0xc1,
      0xa1, 0xdd,
      0xa1, 0xc2,
      0xa1, 0xbd,
    ]);
  });

  it("encodes canonically equivalent decomposed kana to Shift_JIS bytes", () => {
    const composed = buildPaneWriteBytes("がぱ", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });
    const decomposed = buildPaneWriteBytes("か\u3099は\u309A", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(Array.from(decomposed)).toEqual(Array.from(composed));
  });

  it("encodes canonically equivalent decomposed kana to EUC-JP bytes", () => {
    const composed = buildPaneWriteBytes("がぱ", {
      resolvedEncoding: "euc-jp",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });
    const decomposed = buildPaneWriteBytes("か\u3099は\u309A", {
      resolvedEncoding: "euc-jp",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(Array.from(decomposed)).toEqual(Array.from(composed));
  });

  it("falls back to compatibility decomposition for otherwise unencodable Shift_JIS characters", () => {
    const bytes = buildPaneWriteBytes("™", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(new TextDecoder("shift_jis").decode(bytes)).toBe("TM");
  });

  it("keeps directly representable compatibility characters unchanged in Shift_JIS", () => {
    const bytes = buildPaneWriteBytes("㈱", {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: "\n",
    });

    expect(new TextDecoder("shift_jis").decode(bytes)).toBe("㈱");
  });

  it("keeps directly representable ASCII bytes instead of compatibility aliases", () => {
    expect(
      Array.from(buildPaneWriteBytes("\\~-", {
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      })),
    ).toEqual([0x5c, 0x7e, 0x2d]);

    expect(
      Array.from(buildPaneWriteBytes("\\~-", {
        resolvedEncoding: "euc-jp",
        includeUtf8Bom: false,
        lineEnding: "\n",
      })),
    ).toEqual([0x5c, 0x7e, 0x2d]);
  });

  it("throws when the text cannot be represented in the target encoding", async () => {
    let createWritableCalled = false;
    const handle = {
      name: "left.txt",
      async createWritable() {
        createWritableCalled = true;
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
    expect(createWritableCalled).toBe(false);
  });

  it("does not partially write when an unsupported character is present", async () => {
    const written: number[][] = [];
    const handle = {
      name: "left.txt",
      async createWritable() {
        return {
          async write(data: BufferSource) {
            written.push(Array.from(new Uint8Array(data as ArrayBufferLike)));
          },
          async close() {
            return undefined;
          },
        };
      },
    };

    await expect(
      writeTextToFileHandle(handle, "あ🙂い", {
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      }),
    ).rejects.toThrow("shift_jis");

    expect(written).toEqual([]);
  });

  it("aborts the writable stream when a write fails", async () => {
    const written: number[][] = [];
    let aborted = false;
    let closed = false;
    const handle = {
      name: "left.txt",
      async createWritable() {
        return {
          async write(data: BufferSource) {
            written.push(Array.from(new Uint8Array(data as ArrayBufferLike)));
            throw new Error("disk full");
          },
          async abort() {
            aborted = true;
          },
          async close() {
            closed = true;
          },
        };
      },
    };

    await expect(
      writeTextToFileHandle(handle, "a\nb", {
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      }),
    ).rejects.toThrow("disk full");

    expect(written).toEqual([[0x61, 0x0a, 0x62]]);
    expect(aborted).toBe(true);
    expect(closed).toBe(false);
  });

  it("does not close a writable stream without abort when a write fails", async () => {
    let closed = false;
    const handle = {
      name: "left.txt",
      async createWritable() {
        return {
          async write(_data: BufferSource) {
            throw new Error("disk full");
          },
          async close() {
            closed = true;
          },
        };
      },
    };

    await expect(
      writeTextToFileHandle(handle, "a\nb", {
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      }),
    ).rejects.toThrow("disk full");

    expect(closed).toBe(false);
  });

  it("round-trips every directly decodable Shift_JIS character", () => {
    const chars = collectDirectLegacyCharacters("shift_jis");
    const decoder = new TextDecoder("shift_jis");

    chars.forEach((char) => {
      const bytes = buildPaneWriteBytes(char, {
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      });
      expect(decoder.decode(bytes)).toBe(char);
    });
  });

  it("round-trips every directly decodable EUC-JP character", () => {
    const chars = collectDirectLegacyCharacters("euc-jp");
    const decoder = new TextDecoder("euc-jp");

    chars.forEach((char) => {
      const bytes = buildPaneWriteBytes(char, {
        resolvedEncoding: "euc-jp",
        includeUtf8Bom: false,
        lineEnding: "\n",
      });
      expect(decoder.decode(bytes)).toBe(char);
    });
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

  it("keeps large Shift_JIS saves byte-identical across chunk boundaries", async () => {
    const written: number[] = [];
    const sourceText = "あ".repeat(9000);
    const targetMeta = describeDecodedFileForWriteback(toBuffer([0x82, 0xa0]), "shift_jis");

    await saveTextWithPaneTarget(
      {
        handle: {
          name: "large-sjis.txt",
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
        fileName: "large-sjis.txt",
        ...targetMeta,
      },
      sourceText,
    );

    expect(written).toHaveLength(sourceText.length * 2);
    expect(written.slice(0, 6)).toEqual([0x82, 0xa0, 0x82, 0xa0, 0x82, 0xa0]);
    expect(written.slice(-6)).toEqual([0x82, 0xa0, 0x82, 0xa0, 0x82, 0xa0]);
  });
});

describe("readCurrentFileFromPaneTarget", () => {
  it("reads the current external file content and refreshes writeback metadata", async () => {
    const handle = {
      name: "reload.txt",
      async getFile() {
        return new File(["external\r\nchange"], "reload.txt");
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

    const result = await readCurrentFileFromPaneTarget(
      {
        handle,
        fileName: "reload.txt",
        resolvedEncoding: "utf-8",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
      "auto",
    );

    expect(result.file.name).toBe("reload.txt");
    expect(Array.from(result.bytes)).toEqual(
      Array.from(new TextEncoder().encode("external\r\nchange")),
    );
    expect(result.target).toMatchObject({
      handle,
      fileName: "reload.txt",
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
      lineEnding: "\r\n",
    });
  });

  it("keeps the previous legacy encoding for ASCII-only files on auto reload", async () => {
    const handle = {
      name: "ascii-sjis.txt",
      async getFile() {
        return new File(["plain-ascii"], "ascii-sjis.txt");
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

    const result = await readCurrentFileFromPaneTarget(
      {
        handle,
        fileName: "ascii-sjis.txt",
        resolvedEncoding: "shift_jis",
        includeUtf8Bom: false,
        lineEnding: "\n",
      },
      "auto",
    );

    expect(result.target.handle).toBe(handle);
    expect(result.target.resolvedEncoding).toBe("shift_jis");
    expect(result.target.fileName).toBe("ascii-sjis.txt");
  });
});

describe("resolveReloadEncodingForPaneTarget", () => {
  it("uses the pane selection for single-file reloads", () => {
    expect(
      resolveReloadEncodingForPaneTarget({
        fileCount: 1,
        selectedEncoding: "euc-jp",
        target: {
          handle: { name: "single.txt", async getFile() { return new File([""], "single.txt"); } },
          fileName: "single.txt",
          resolvedEncoding: "shift_jis",
          includeUtf8Bom: false,
          lineEnding: "\n",
        },
      }),
    ).toBe("euc-jp");
  });

  it("keeps file-specific encodings for multi-file reloads", () => {
    expect(
      resolveReloadEncodingForPaneTarget({
        fileCount: 2,
        selectedEncoding: "shift_jis",
        target: {
          handle: { name: "right.txt", async getFile() { return new File([""], "right.txt"); } },
          fileName: "right.txt",
          resolvedEncoding: "euc-jp",
          includeUtf8Bom: false,
          lineEnding: "\n",
        },
      }),
    ).toBe("euc-jp");
  });

  it("keeps auto reload when the pane stays in auto mode", () => {
    expect(
      resolveReloadEncodingForPaneTarget({
        fileCount: 3,
        selectedEncoding: "auto",
        target: {
          handle: { name: "right.txt", async getFile() { return new File([""], "right.txt"); } },
          fileName: "right.txt",
          resolvedEncoding: "euc-jp",
          includeUtf8Bom: false,
          lineEnding: "\n",
        },
      }),
    ).toBe("auto");
  });
});
