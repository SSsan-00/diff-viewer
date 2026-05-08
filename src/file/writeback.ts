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

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  );
}

function isAsciiOnlyBytes(bytes: Uint8Array): boolean {
  return bytes.every((byte) => byte <= 0x7f);
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

function getLineEndingBytes(lineEnding: FileLineEnding): Uint8Array {
  return Uint8Array.from(Array.from(lineEnding).map((char) => char.charCodeAt(0)));
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

function encodeLegacyTextStrict(
  text: string,
  map: Map<string, Uint8Array>,
): Uint8Array | null {
  const bytes: number[] = [];

  for (const char of Array.from(text)) {
    const direct = map.get(char);
    if (direct) {
      bytes.push(...direct);
      continue;
    }
    return null;
  }

  return Uint8Array.from(bytes);
}

function findFirstLegacyUnencodableChar(
  text: string,
  map: Map<string, Uint8Array>,
): string {
  for (const char of Array.from(text)) {
    if (map.has(char)) {
      continue;
    }
    return char;
  }
  return "";
}

type WriteEncodingOptions = {
  resolvedEncoding: ResolvedFileEncoding;
  includeUtf8Bom: boolean;
  lineEnding: FileLineEnding;
};

type EncodedSourceLine = {
  text: string;
  bytes: Uint8Array;
};

function decodeLineBodyForWriteback(
  bytes: Uint8Array,
  options: WriteEncodingOptions,
  lineIndex: number,
): string {
  const body =
    options.resolvedEncoding === "utf-8" &&
    lineIndex === 0 &&
    hasUtf8Bom(bytes)
      ? bytes.slice(UTF8_BOM.length)
      : bytes;
  if (options.resolvedEncoding === "utf-8") {
    return decodeUtf8(body, true);
  }
  return new TextDecoder(options.resolvedEncoding).decode(body);
}

function splitEncodedSourceLines(
  bytes: Uint8Array,
  options: WriteEncodingOptions,
): EncodedSourceLine[] {
  const lines: EncodedSourceLine[] = [];
  let bodyStart = 0;
  let lineIndex = 0;

  const pushLine = (bodyEnd: number, lineEnd: number) => {
    const lineBytes = bytes.slice(bodyStart, lineEnd);
    const bodyBytes = bytes.slice(bodyStart, bodyEnd);
    lines.push({
      text: decodeLineBodyForWriteback(bodyBytes, options, lineIndex),
      bytes: lineBytes,
    });
    lineIndex += 1;
    bodyStart = lineEnd;
  };

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte === 0x0d) {
      const lineEnd = bytes[index + 1] === 0x0a ? index + 2 : index + 1;
      pushLine(index, lineEnd);
      index = lineEnd - 1;
      continue;
    }
    if (byte === 0x0a) {
      pushLine(index, index + 1);
    }
  }

  pushLine(bytes.length, bytes.length);
  return lines;
}

function encodeLineBodyForWriteback(
  text: string,
  options: WriteEncodingOptions,
  includeUtf8Bom: boolean,
): Uint8Array {
  if (options.resolvedEncoding === "utf-8") {
    const body = new TextEncoder().encode(text);
    if (!includeUtf8Bom) {
      return body;
    }
    const result = new Uint8Array(UTF8_BOM.length + body.length);
    result.set(UTF8_BOM, 0);
    result.set(body, UTF8_BOM.length);
    return result;
  }

  const map = getLegacyEncodeMap(options.resolvedEncoding);
  const encoded = encodeLegacyTextStrict(text, map);
  if (!encoded) {
    const failedChar = findFirstLegacyUnencodableChar(text, map);
    throw new Error(`Cannot encode character for ${options.resolvedEncoding}: ${failedChar}`);
  }
  return encoded;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
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

function isSameDroppedFile(left: File, right: File): boolean {
  return (
    left === right ||
    (
      left.name === right.name &&
      left.size === right.size &&
      left.type === right.type &&
      left.lastModified === right.lastModified
    )
  );
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
  const files = Array.from(dataTransfer?.files ?? []);
  if (items.length > 0) {
    const droppedRequests: Array<{
      file: File;
      handle: Promise<ReadableFileHandle | null>;
    }> = [];
    for (const item of items) {
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile?.();
      if (!file) {
        continue;
      }
      let handle = Promise.resolve<ReadableFileHandle | null>(null);
      if (typeof item.getAsFileSystemHandle === "function") {
        try {
          handle = Promise.resolve(item.getAsFileSystemHandle())
            .then((candidate) => isReadableFileHandle(candidate) ? candidate : null)
            .catch(() => null);
        } catch (_error) {
          handle = Promise.resolve(null);
        }
      }
      droppedRequests.push({ file, handle });
    }
    const dropped = await Promise.all(
      droppedRequests.map(async (item) => ({
        file: item.file,
        handle: await item.handle,
      })),
    );
    if (dropped.length > 0) {
      if (files.length <= dropped.length) {
        return dropped;
      }
      const remaining = [...dropped];
      return files.map((file) => {
        const matchIndex = remaining.findIndex((item) =>
          isSameDroppedFile(item.file, file),
        );
        if (matchIndex === -1) {
          return { file, handle: null };
        }
        const [matched] = remaining.splice(matchIndex, 1);
        return { file, handle: matched.handle };
      });
    }
  }

  return files.map((file) => ({
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
  options: WriteEncodingOptions,
): Uint8Array {
  if (options.resolvedEncoding === "utf-8") {
    return encodeUtf8TextForWriteback(text, {
      includeUtf8Bom: options.includeUtf8Bom,
      lineEnding: options.lineEnding,
    });
  }

  const normalized = normalizeLineEndingsForWriteback(text, options.lineEnding);
  const map = getLegacyEncodeMap(options.resolvedEncoding);
  const encoded = encodeLegacyTextStrict(normalized, map);
  if (!encoded) {
    const failedChar = findFirstLegacyUnencodableChar(normalized, map);
    throw new Error(`Cannot encode character for ${options.resolvedEncoding}: ${failedChar}`);
  }
  return encoded;
}

export function buildPaneWriteBytesPreservingSource(
  text: string,
  options: WriteEncodingOptions,
  sourceBytes: Uint8Array | null | undefined,
): Uint8Array {
  if (!sourceBytes) {
    return buildPaneWriteBytes(text, options);
  }

  const sourceLines = splitEncodedSourceLines(sourceBytes, options);
  const currentLines = text.split("\n");
  let prefixLength = 0;
  while (
    prefixLength < sourceLines.length &&
    prefixLength < currentLines.length &&
    sourceLines[prefixLength]?.text === currentLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let sourceSuffixStart = sourceLines.length;
  let currentSuffixStart = currentLines.length;
  while (
    sourceSuffixStart > prefixLength &&
    currentSuffixStart > prefixLength &&
    sourceLines[sourceSuffixStart - 1]?.text === currentLines[currentSuffixStart - 1]
  ) {
    sourceSuffixStart -= 1;
    currentSuffixStart -= 1;
  }

  const lineEndingBytes = getLineEndingBytes(options.lineEnding);
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < currentLines.length; index += 1) {
    if (index < prefixLength) {
      chunks.push(sourceLines[index]?.bytes ?? new Uint8Array());
      continue;
    }
    if (index >= currentSuffixStart) {
      const sourceIndex = sourceSuffixStart + index - currentSuffixStart;
      chunks.push(sourceLines[sourceIndex]?.bytes ?? new Uint8Array());
      continue;
    }

    chunks.push(
      encodeLineBodyForWriteback(
        currentLines[index] ?? "",
        options,
        index === 0 && options.includeUtf8Bom,
      ),
    );
    if (index < currentLines.length - 1) {
      chunks.push(lineEndingBytes);
    }
  }

  return concatBytes(chunks);
}

export async function writeTextToFileHandle(
  handle: WritableFileHandle,
  text: string,
  options: WriteEncodingOptions,
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
  const resolvedEncoding =
    encoding === "auto" && !hasUtf8Bom(bytes) && isAsciiOnlyBytes(bytes)
      ? target.resolvedEncoding
      : metadata.resolvedEncoding;
  return {
    file,
    bytes,
    target: {
      handle: target.handle,
      fileName: file.name,
      resolvedEncoding,
      includeUtf8Bom: metadata.includeUtf8Bom,
      lineEnding: metadata.lineEnding,
    },
  };
}

export function resolveReloadEncodingForPaneTarget(options: {
  fileCount: number;
  selectedEncoding: FileEncoding;
  target: PaneSaveTarget;
}): FileEncoding {
  if (options.selectedEncoding === "auto") {
    return "auto";
  }
  if (options.fileCount <= 1) {
    return options.selectedEncoding;
  }
  return options.target.resolvedEncoding;
}
