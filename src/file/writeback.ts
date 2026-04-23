import type { FileEncoding } from "./decode";

export type ResolvedFileEncoding = Exclude<FileEncoding, "auto">;
export type FileLineEnding = "\n" | "\r\n" | "\r";

export type PaneWriteHandle = {
  name?: string;
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

export type WritableFileStream = {
  write: (data: BufferSource) => Promise<void>;
  abort?: () => Promise<void>;
  close: () => Promise<void>;
};

export type WritableFileHandle = PaneWriteHandle & {
  createWritable: () => Promise<WritableFileStream>;
};

export type ReadableFileHandle = PaneWriteHandle & {
  name: string;
  getFile: () => Promise<File>;
};

export type ReadableWritableFileHandle = ReadableFileHandle & WritableFileHandle;

export type FileSystemAccessWindow = {
  showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<ReadableFileHandle[]>;
};

export type DroppedFileItem = {
  file: File;
  handle: ReadableFileHandle | null;
};

export type DropDataTransferItem = {
  kind: string;
  getAsFile?: () => File | null;
  getAsFileSystemHandle?: () => Promise<unknown>;
};

export type DropDataTransfer = {
  items?: ArrayLike<DropDataTransferItem> | null;
  files?: ArrayLike<File> | null;
};

export type PaneWriteTarget = {
  handle: PaneWriteHandle;
  fileName: string;
  resolvedEncoding: ResolvedFileEncoding;
  includeUtf8Bom: boolean;
  lineEnding: FileLineEnding;
};

export type WritablePaneWriteTarget = Omit<PaneWriteTarget, "handle"> & {
  handle: WritableFileHandle;
};

export type PaneSaveTarget = Omit<PaneWriteTarget, "handle"> & {
  handle: ReadableFileHandle;
};

export type PaneWriteAvailability = {
  enabled: boolean;
  reason: string | null;
};

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const WRITE_CHUNK_BYTE_LIMIT = 16 * 1024;
const legacyEncodeMaps: Partial<Record<"shift_jis" | "euc-jp", Map<string, Uint8Array>>> = {};
const legacyEncodeAliasMaps: Partial<Record<"shift_jis" | "euc-jp", Map<string, Uint8Array>>> = {};
const legacyExplicitEncodeAliases: Record<"shift_jis" | "euc-jp", Map<string, Uint8Array>> = {
  shift_jis: new Map([
    ["¥", Uint8Array.from([0x5c])],
    ["‾", Uint8Array.from([0x7e])],
    ["〜", Uint8Array.from([0x81, 0x60])],
    ["−", Uint8Array.from([0x81, 0x7c])],
    ["‖", Uint8Array.from([0x81, 0x61])],
    ["—", Uint8Array.from([0x81, 0x5c])],
  ]),
  "euc-jp": new Map([
    ["¥", Uint8Array.from([0x5c])],
    ["‾", Uint8Array.from([0x7e])],
    ["〜", Uint8Array.from([0xa1, 0xc1])],
    ["−", Uint8Array.from([0xa1, 0xdd])],
    ["‖", Uint8Array.from([0xa1, 0xc2])],
    ["—", Uint8Array.from([0xa1, 0xbd])],
  ]),
};

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  );
}

function isReadableFileHandle(value: unknown): value is ReadableFileHandle {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as {
    kind?: unknown;
    getFile?: unknown;
    name?: unknown;
  };
  if (candidate.kind !== undefined && candidate.kind !== "file") {
    return false;
  }
  return typeof candidate.name === "string" && typeof candidate.getFile === "function";
}

function decodeUtf8(bytes: Uint8Array, fatal: boolean): string {
  return new TextDecoder("utf-8", { fatal }).decode(bytes);
}

function countReplacementCharacters(text: string): number {
  return Array.from(text).filter((char) => char === "\uFFFD").length;
}

function countJapaneseCharacters(text: string): number {
  let count = 0;
  for (const char of Array.from(text)) {
    const codePoint = char.codePointAt(0);
    if (!codePoint) {
      continue;
    }
    const isHiragana = codePoint >= 0x3040 && codePoint <= 0x309f;
    const isKatakana = codePoint >= 0x30a0 && codePoint <= 0x30ff;
    const isCjk = codePoint >= 0x4e00 && codePoint <= 0x9fff;
    if (isHiragana || isKatakana || isCjk) {
      count += 1;
    }
  }
  return count;
}

function pickAutoDecodedText(bytes: Uint8Array): {
  text: string;
  resolvedEncoding: ResolvedFileEncoding;
  includeUtf8Bom: boolean;
} {
  if (hasUtf8Bom(bytes)) {
    return {
      text: decodeUtf8(bytes.slice(3), false),
      resolvedEncoding: "utf-8",
      includeUtf8Bom: true,
    };
  }

  try {
    return {
      text: decodeUtf8(bytes, true),
      resolvedEncoding: "utf-8",
      includeUtf8Bom: false,
    };
  } catch (_error) {
    const shiftJis = new TextDecoder("shift_jis").decode(bytes);
    const eucJp = new TextDecoder("euc-jp").decode(bytes);
    const shiftJisReplacement = countReplacementCharacters(shiftJis);
    const eucJpReplacement = countReplacementCharacters(eucJp);

    if (shiftJisReplacement !== eucJpReplacement) {
      return shiftJisReplacement <= eucJpReplacement
        ? {
            text: shiftJis,
            resolvedEncoding: "shift_jis",
            includeUtf8Bom: false,
          }
        : {
            text: eucJp,
            resolvedEncoding: "euc-jp",
            includeUtf8Bom: false,
          };
    }

    const shiftJisJapanese = countJapaneseCharacters(shiftJis);
    const eucJpJapanese = countJapaneseCharacters(eucJp);
    if (shiftJisJapanese !== eucJpJapanese) {
      return shiftJisJapanese >= eucJpJapanese
        ? {
            text: shiftJis,
            resolvedEncoding: "shift_jis",
            includeUtf8Bom: false,
          }
        : {
            text: eucJp,
            resolvedEncoding: "euc-jp",
            includeUtf8Bom: false,
          };
    }

    return {
      text: shiftJis,
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
    };
  }
}

export function detectLineEnding(text: string): FileLineEnding {
  const crlfIndex = text.indexOf("\r\n");
  if (crlfIndex >= 0) {
    return "\r\n";
  }
  if (text.includes("\r")) {
    return "\r";
  }
  return "\n";
}

function normalizeLineEndingsForWriteback(
  text: string,
  lineEnding: FileLineEnding,
): string {
  return lineEnding === "\n" ? text : text.replace(/\n/g, lineEnding);
}

function normalizeLegacyTextForWriteback(text: string): string {
  return text.normalize("NFC");
}

function registerEncodedCharacter(
  map: Map<string, Uint8Array>,
  decoder: TextDecoder,
  bytes: readonly number[],
): void {
  const encoded = Uint8Array.from(bytes);
  const decoded = decoder.decode(encoded);
  if (decoded.includes("\uFFFD")) {
    return;
  }
  const chars = Array.from(decoded);
  if (chars.length !== 1) {
    return;
  }
  const char = chars[0] ?? "";
  const existing = map.get(char);
  if (!existing || encoded.length < existing.length) {
    map.set(char, encoded);
  }
}

function buildShiftJisEncodeMap(): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  const decoder = new TextDecoder("shift_jis");
  for (let byte = 0x00; byte <= 0x7f; byte += 1) {
    registerEncodedCharacter(map, decoder, [byte]);
  }
  for (let byte = 0xa1; byte <= 0xdf; byte += 1) {
    registerEncodedCharacter(map, decoder, [byte]);
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
      registerEncodedCharacter(map, decoder, [lead, trail]);
    }
  }
  for (let lead = 0xe0; lead <= 0xfc; lead += 1) {
    for (const trail of trailBytes) {
      registerEncodedCharacter(map, decoder, [lead, trail]);
    }
  }
  return map;
}

function buildEucJpEncodeMap(): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  const decoder = new TextDecoder("euc-jp");
  for (let byte = 0x00; byte <= 0x7f; byte += 1) {
    registerEncodedCharacter(map, decoder, [byte]);
  }
  for (let byte = 0xa1; byte <= 0xdf; byte += 1) {
    registerEncodedCharacter(map, decoder, [0x8e, byte]);
  }
  for (let lead = 0xa1; lead <= 0xfe; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      registerEncodedCharacter(map, decoder, [lead, trail]);
    }
  }
  for (let lead = 0xa1; lead <= 0xfe; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      registerEncodedCharacter(map, decoder, [0x8f, lead, trail]);
    }
  }
  return map;
}

function getLegacyEncodeMap(encoding: "shift_jis" | "euc-jp"): Map<string, Uint8Array> {
  const cached = legacyEncodeMaps[encoding];
  if (cached) {
    return cached;
  }
  const map = encoding === "shift_jis" ? buildShiftJisEncodeMap() : buildEucJpEncodeMap();
  legacyEncodeMaps[encoding] = map;
  return map;
}

function getLegacyEncodeAliases(
  encoding: "shift_jis" | "euc-jp",
): Map<string, Uint8Array> {
  const cached = legacyEncodeAliasMaps[encoding];
  if (cached) {
    return cached;
  }

  const directMap = getLegacyEncodeMap(encoding);
  const aliases = new Map(legacyExplicitEncodeAliases[encoding]);
  for (const [decoded, bytes] of directMap) {
    const normalized = decoded.normalize("NFKC");
    if (
      normalized === decoded ||
      Array.from(normalized).length !== 1 ||
      directMap.has(normalized) ||
      aliases.has(normalized)
    ) {
      continue;
    }
    aliases.set(normalized, bytes);
  }

  legacyEncodeAliasMaps[encoding] = aliases;
  return aliases;
}

export function describeDecodedFileForWriteback(
  buffer: ArrayBuffer,
  encoding: FileEncoding,
): {
  resolvedEncoding: ResolvedFileEncoding;
  includeUtf8Bom: boolean;
  lineEnding: FileLineEnding;
} {
  const bytes = new Uint8Array(buffer);
  if (encoding === "utf-8") {
    return {
      resolvedEncoding: "utf-8",
      includeUtf8Bom: hasUtf8Bom(bytes),
      lineEnding: detectLineEnding(decodeUtf8(bytes, true)),
    };
  }
  if (encoding === "shift_jis") {
    return {
      resolvedEncoding: "shift_jis",
      includeUtf8Bom: false,
      lineEnding: detectLineEnding(new TextDecoder("shift_jis").decode(bytes)),
    };
  }
  if (encoding === "euc-jp") {
    return {
      resolvedEncoding: "euc-jp",
      includeUtf8Bom: false,
      lineEnding: detectLineEnding(new TextDecoder("euc-jp").decode(bytes)),
    };
  }
  const decoded = pickAutoDecodedText(bytes);
  return {
    resolvedEncoding: decoded.resolvedEncoding,
    includeUtf8Bom: decoded.includeUtf8Bom,
    lineEnding: detectLineEnding(decoded.text),
  };
}

export function encodeUtf8TextForWriteback(
  text: string,
  options: {
    includeUtf8Bom: boolean;
    lineEnding: FileLineEnding;
  },
): Uint8Array {
  const normalized = normalizeLineEndingsForWriteback(text, options.lineEnding);
  const body = new TextEncoder().encode(normalized);
  if (!options.includeUtf8Bom) {
    return body;
  }
  const result = new Uint8Array(UTF8_BOM.length + body.length);
  result.set(UTF8_BOM, 0);
  result.set(body, UTF8_BOM.length);
  return result;
}

export function getPaneWriteAvailability(options: {
  hasFileSystemAccess: boolean;
  fileCount: number;
  selectedEncoding: FileEncoding;
  target: PaneWriteTarget | null;
}): PaneWriteAvailability {
  const { hasFileSystemAccess, fileCount, selectedEncoding, target } = options;
  if (fileCount === 0) {
    return {
      enabled: false,
      reason: "保存できるファイルがありません。",
    };
  }
  if (fileCount !== 1) {
    return {
      enabled: false,
      reason: "単一ファイル比較のときだけ保存できます。",
    };
  }
  if (!hasFileSystemAccess) {
    return {
      enabled: false,
      reason: "このブラウザでは上書き保存に対応していません。",
    };
  }
  if (!target?.handle) {
    return {
      enabled: false,
      reason: "ファイル選択ボタンから開いた単一ファイルだけ保存できます。",
    };
  }
  if (typeof (target.handle as { createWritable?: unknown }).createWritable !== "function") {
    return {
      enabled: false,
      reason: "保存用のファイルハンドルがありません。",
    };
  }
  if (selectedEncoding !== "auto" && selectedEncoding !== target.resolvedEncoding) {
    return {
      enabled: false,
      reason: "元の文字コード表示中のときだけ保存できます。",
    };
  }
  return {
    enabled: true,
    reason: null,
  };
}

export function supportsFileSystemAccess(
  win: FileSystemAccessWindow,
): boolean {
  return typeof win.showOpenFilePicker === "function";
}

export async function requestFileHandlePermission(
  handle: PaneWriteHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) {
    return true;
  }
  const descriptor = { mode };
  if (await handle.queryPermission(descriptor) === "granted") {
    return true;
  }
  return (await handle.requestPermission(descriptor)) === "granted";
}

export async function collectDroppedFiles(
  dataTransfer: DropDataTransfer | null | undefined,
): Promise<DroppedFileItem[]> {
  const items = Array.from(dataTransfer?.items ?? []);
  if (items.length > 0) {
    const dropped: DroppedFileItem[] = [];
    for (const item of items) {
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile?.();
      if (!file) {
        continue;
      }
      let handle: ReadableFileHandle | null = null;
      if (typeof item.getAsFileSystemHandle === "function") {
        try {
          const candidate = await item.getAsFileSystemHandle();
          if (isReadableFileHandle(candidate)) {
            handle = candidate;
          }
        } catch (_error) {
          handle = null;
        }
      }
      dropped.push({ file, handle });
    }
    if (dropped.length > 0) {
      return dropped;
    }
  }

  return Array.from(dataTransfer?.files ?? []).map((file) => ({
    file,
    handle: null,
  }));
}

export async function pickFilesWithHandles(
  win: FileSystemAccessWindow,
  options: { multiple?: boolean } = {},
): Promise<{
  handles: ReadableFileHandle[];
  files: File[];
}> {
  if (!win.showOpenFilePicker) {
    return {
      handles: [],
      files: [],
    };
  }
  const handles = await win.showOpenFilePicker({
    multiple: options.multiple ?? true,
  });
  const files = await Promise.all(handles.map((handle) => handle.getFile()));
  return { handles, files };
}

export function buildPaneWriteBytes(
  text: string,
  options: {
    resolvedEncoding: ResolvedFileEncoding;
    includeUtf8Bom: boolean;
    lineEnding: FileLineEnding;
  },
): Uint8Array {
  if (options.resolvedEncoding === "utf-8") {
    return encodeUtf8TextForWriteback(text, {
      includeUtf8Bom: options.includeUtf8Bom,
      lineEnding: options.lineEnding,
    });
  }

  const normalized = normalizeLegacyTextForWriteback(
    normalizeLineEndingsForWriteback(text, options.lineEnding),
  );
  const map = getLegacyEncodeMap(options.resolvedEncoding);
  const aliases = getLegacyEncodeAliases(options.resolvedEncoding);
  const bytes: number[] = [];

  for (const char of normalized) {
    const encoded = map.get(char) ?? aliases.get(char);
    if (!encoded) {
      throw new Error(`Cannot encode character for ${options.resolvedEncoding}: ${char}`);
    }
    bytes.push(...encoded);
  }

  return Uint8Array.from(bytes);
}

export async function writeTextToFileHandle(
  handle: WritableFileHandle,
  text: string,
  options: {
    resolvedEncoding: ResolvedFileEncoding;
    includeUtf8Bom: boolean;
    lineEnding: FileLineEnding;
  },
): Promise<void> {
  const bytes = buildPaneWriteBytes(text, options);
  await writeBytesToFileHandle(handle, bytes);
}

export async function writeBytesToFileHandle(
  handle: WritableFileHandle,
  bytes: Uint8Array,
): Promise<void> {
  const writable = await handle.createWritable();
  try {
    for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTE_LIMIT) {
      await writable.write(bytes.slice(offset, offset + WRITE_CHUNK_BYTE_LIMIT));
    }
    await writable.close();
  } catch (error) {
    if (typeof writable.abort === "function") {
      await writable.abort();
    } else {
      await writable.close();
    }
    throw error;
  }
}

export async function saveTextWithPaneTarget(
  target: WritablePaneWriteTarget,
  text: string,
): Promise<void> {
  await writeTextToFileHandle(target.handle, text, {
    resolvedEncoding: target.resolvedEncoding,
    includeUtf8Bom: target.includeUtf8Bom,
    lineEnding: target.lineEnding,
  });
}

export async function readCurrentFileFromPaneTarget(
  target: PaneSaveTarget,
  encoding: FileEncoding,
): Promise<{
  file: File;
  bytes: Uint8Array;
  target: PaneSaveTarget;
}> {
  const file = await target.handle.getFile();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const metadata = describeDecodedFileForWriteback(buffer, encoding);
  return {
    file,
    bytes,
    target: {
      handle: target.handle,
      fileName: file.name,
      resolvedEncoding: metadata.resolvedEncoding,
      includeUtf8Bom: metadata.includeUtf8Bom,
      lineEnding: metadata.lineEnding,
    },
  };
}
