import { decodeArrayBuffer, type FileEncoding } from "./decode";
import { normalizeText } from "../diffEngine/normalize";
import type { LineSegment } from "./lineNumbering";
import { normalizeLastSegmentForAppend } from "./segmentAppend";

export type FileBytes = {
  name: string;
  bytes: Uint8Array;
  encoding?: FileEncoding;
};

export type DecodedFilesResult = {
  text: string;
  segments: LineSegment[];
};

function appendTextAtLine(
  currentValue: string,
  nextValue: string,
  startLine: number,
): string {
  const currentLineCount = currentValue.split("\n").length;
  const separatorCount = Math.max(0, startLine - currentLineCount);
  return currentValue + "\n".repeat(separatorCount) + nextValue;
}

function getAppendStartLine(
  text: string,
  segments: readonly LineSegment[],
): number {
  if (!text) {
    return segments.length === 0
      ? 1
      : Math.max(
          1,
          segments[segments.length - 1].startLine +
            segments[segments.length - 1].lineCount,
        );
  }
  const modelLineCount = text.split("\n").length;
  const textAppendLine = text.endsWith("\n")
    ? modelLineCount
    : modelLineCount + 1;
  if (segments.length === 0) {
    return textAppendLine;
  }
  const lastSegment = segments[segments.length - 1];
  return Math.max(
    textAppendLine,
    lastSegment.startLine + lastSegment.lineCount,
  );
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
  options?: { preferFileEncoding?: boolean },
): DecodedFilesResult {
  let text = currentText;
  const segments = [...currentSegments];

  files.forEach((file, index) => {
    normalizeLastSegmentForAppend(segments, text);

    const buffer = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    );
    const decodedEncoding =
      options?.preferFileEncoding === true ? file.encoding ?? encoding : encoding;
    const decoded = normalizeText(decodeArrayBuffer(buffer, decodedEncoding));
    const includeTrailingEmptyLine = index === files.length - 1;
    const { lineCount, endsWithNewline } = getLogicalLineCount(
      decoded,
      includeTrailingEmptyLine,
    );
    const startLine = getAppendStartLine(text, segments);
    const fileIndex = segments.length + 1;

    segments.push({
      startLine,
      lineCount,
      fileIndex,
      fileName: file.name,
      endsWithNewline,
    });
    text = appendTextAtLine(text, decoded, startLine);
  });

  return { text, segments };
}

export function buildDecodedFiles(
  files: FileBytes[],
  encoding: FileEncoding,
  options?: { preferFileEncoding?: boolean },
): DecodedFilesResult {
  return appendDecodedFiles("", [], files, encoding, options);
}
