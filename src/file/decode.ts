export type FileEncoding = "utf-8" | "shift_jis" | "euc-jp" | "auto";

const UTF8_BOM = [0xef, 0xbb, 0xbf];

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  );
}

function decodeUtf8(bytes: Uint8Array, fatal: boolean): string {
  const decoder = new TextDecoder("utf-8", { fatal });
  return decoder.decode(bytes);
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

function pickBestDecodedText(options: [string, string]): string {
  const [shiftJis, eucJp] = options;
  const shiftJisReplacement = countReplacementCharacters(shiftJis);
  const eucJpReplacement = countReplacementCharacters(eucJp);

  if (shiftJisReplacement !== eucJpReplacement) {
    return shiftJisReplacement <= eucJpReplacement ? shiftJis : eucJp;
  }

  const shiftJisJapanese = countJapaneseCharacters(shiftJis);
  const eucJpJapanese = countJapaneseCharacters(eucJp);

  if (shiftJisJapanese !== eucJpJapanese) {
    return shiftJisJapanese >= eucJpJapanese ? shiftJis : eucJp;
  }

  return shiftJis;
}

function decodeAuto(bytes: Uint8Array): string {
  if (hasUtf8Bom(bytes)) {
    return decodeUtf8(bytes.slice(3), false);
  }

  try {
    return decodeUtf8(bytes, true);
  } catch (error) {
    const shiftJis = new TextDecoder("shift_jis").decode(bytes);
    const eucJp = new TextDecoder("euc-jp").decode(bytes);
    return pickBestDecodedText([shiftJis, eucJp]);
  }
}

export function decodeArrayBuffer(buffer: ArrayBuffer, encoding: FileEncoding): string {
  const bytes = new Uint8Array(buffer);

  if (encoding === "utf-8") {
    return decodeUtf8(bytes, true);
  }

  if (encoding === "shift_jis") {
    return new TextDecoder("shift_jis").decode(bytes);
  }

  if (encoding === "euc-jp") {
    return new TextDecoder("euc-jp").decode(bytes);
  }

  return decodeAuto(bytes);
}
