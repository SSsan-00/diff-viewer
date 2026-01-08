import { decodeArrayBuffer, type FileEncoding } from "./decode";
import { normalizeText } from "../diffEngine/normalize";
import type { LineSegment } from "./lineNumbering";

export type FileBytes = {
  name: string;
  bytes: Uint8Array;
};

export type DecodedFilesResult = {
  text: string;
  segments: LineSegment[];
};

function getAppendStartLine(currentValue: string, currentLineCount: number): number {
  if (!currentValue) {
    return 1;
  }
  return currentLineCount + (currentValue.endsWith("\n") ? 0 : 1);
}

export function buildDecodedFiles(
  files: FileBytes[],
  encoding: FileEncoding,
): DecodedFilesResult {
  const segments: LineSegment[] = [];
  let currentValue = "";
  let currentLineCount = 0;

  files.forEach((file, index) => {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment?.endsWithNewline) {
      lastSegment.lineCount = Math.max(1, lastSegment.lineCount - 1);
      lastSegment.endsWithNewline = false;
    }

    const buffer = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    );
    const decoded = normalizeText(decodeArrayBuffer(buffer, encoding));
    const endsWithNewline = decoded.endsWith("\n");
    const startLine = getAppendStartLine(currentValue, currentLineCount);
    const lineCount = decoded.split("\n").length;

    segments.push({
      startLine,
      lineCount,
      fileIndex: index + 1,
      fileName: file.name,
      endsWithNewline,
    });

    currentValue = currentValue
      ? currentValue + (currentValue.endsWith("\n") ? "" : "\n") + decoded
      : decoded;
    currentLineCount = currentValue.split("\n").length;
  });

  return { text: currentValue, segments };
}
