import { decodeArrayBuffer, type FileEncoding } from "./decode";
import { normalizeText } from "../diffEngine/normalize";
import type { LineSegment } from "./lineNumbering";
import { normalizeLastSegmentForAppend } from "./segmentAppend";

export type FileBytes = {
  name: string;
  bytes: Uint8Array;
};

export type DecodedFilesResult = {
  text: string;
  segments: LineSegment[];
};

function appendText(currentValue: string, nextValue: string): string {
  if (!currentValue) {
    return nextValue;
  }
  const separator = currentValue.endsWith("\n") ? "" : "\n";
  return currentValue + separator + nextValue;
}

function getLogicalLineCount(
  text: string,
  includeTrailingEmptyLine: boolean,
): { lineCount: number; endsWithNewline: boolean } {
  const endsWithNewline = text.endsWith("\n");
  const lines = text.split("\n");
  const lineCount = endsWithNewline && !includeTrailingEmptyLine
    ? Math.max(1, lines.length - 1)
    : Math.max(1, lines.length);
  return { lineCount, endsWithNewline };
}

export function appendDecodedFiles(
  currentText: string,
  currentSegments: LineSegment[],
  files: FileBytes[],
  encoding: FileEncoding,
): DecodedFilesResult {
  let text = currentText;
  const segments = [...currentSegments];

  files.forEach((file, index) => {
    normalizeLastSegmentForAppend(segments, text);

    const buffer = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    );
    const decoded = normalizeText(decodeArrayBuffer(buffer, encoding));
    const includeTrailingEmptyLine = index === files.length - 1;
    const { lineCount, endsWithNewline } = getLogicalLineCount(
      decoded,
      includeTrailingEmptyLine,
    );
    const startLine =
      segments.length === 0
        ? 1
        : segments[segments.length - 1].startLine + segments[segments.length - 1].lineCount;
    const fileIndex = segments.length + 1;

    segments.push({
      startLine,
      lineCount,
      fileIndex,
      fileName: file.name,
      endsWithNewline,
    });
    text = appendText(text, decoded);
  });

  return { text, segments };
}

export function buildDecodedFiles(
  files: FileBytes[],
  encoding: FileEncoding,
): DecodedFilesResult {
  return appendDecodedFiles("", [], files, encoding);
}
