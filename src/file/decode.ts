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

  // auto mode: UTF-8 BOM -> UTF-8, otherwise try UTF-8 (fatal).
  if (hasUtf8Bom(bytes)) {
    return decodeUtf8(bytes.slice(3), false);
  }

  try {
    return decodeUtf8(bytes, true);
  } catch (error) {
    throw new Error("文字コードを選択してください");
  }
}
