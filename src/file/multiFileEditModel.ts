import type { LineChange, LineSegment } from "./lineNumbering";
import type { FileBytes } from "./decodedFiles";
import {
  buildPaneWriteBytesPreservingSource,
  type PaneSaveTarget,
} from "./writeback";

export type SegmentText = {
  fileName?: string;
  text: string;
};

export type MultiFileWriteItem<TTarget extends PaneSaveTarget = PaneSaveTarget> = {
  target: TTarget;
  text: string;
  bytes: Uint8Array;
};

export function isFullySegmentedText(
  text: string,
  segments: readonly LineSegment[],
): boolean {
  if (segments.length === 0) {
    return text === "";
  }
  let expectedStartLine = 1;
  for (const segment of segments) {
    if (segment.startLine !== expectedStartLine || segment.lineCount < 1) {
      return false;
    }
    expectedStartLine += segment.lineCount;
  }
  return expectedStartLine - 1 === text.split("\n").length;
}

export function canUsePaneSaveTargets(
  text: string,
  segments: readonly LineSegment[],
  targets: readonly { fileName: string }[],
): boolean {
  return (
    isFullySegmentedText(text, segments) &&
    segments.length === targets.length &&
    segments.every(
      (segment, index) =>
        segment.fileName !== undefined &&
        segment.fileName === targets[index]?.fileName,
    )
  );
}

function findSegmentIndexAtLine(
  segments: readonly LineSegment[],
  lineNumber: number,
): number {
  return segments.findIndex((segment) => {
    const endLine = segment.startLine + segment.lineCount - 1;
    return lineNumber >= segment.startLine && lineNumber <= endLine;
  });
}

function findLineRegion(
  segments: readonly LineSegment[],
  lineNumber: number,
): string {
  const segmentIndex = findSegmentIndexAtLine(segments, lineNumber);
  if (segmentIndex >= 0) {
    return `segment:${segmentIndex}`;
  }
  const nextSegmentIndex = segments.findIndex(
    (segment) => segment.startLine > lineNumber,
  );
  return `unmanaged:${nextSegmentIndex < 0 ? segments.length : nextSegmentIndex}`;
}

export function areChangesWithinSingleFileSegments(
  segments: readonly LineSegment[],
  changes: readonly LineChange[],
): boolean {
  if (segments.length === 0) {
    return true;
  }

  return changes.every(
    (change) =>
      findLineRegion(segments, change.range.startLineNumber) ===
      findLineRegion(segments, change.range.endLineNumber),
  );
}

export function extractSegmentTexts(
  text: string,
  segments: readonly LineSegment[],
): SegmentText[] {
  const lines = text.split("\n");
  return segments.map((segment) => {
    const startIndex = Math.max(0, segment.startLine - 1);
    const endIndex = startIndex + Math.max(1, segment.lineCount);
    const selected = lines.slice(startIndex, endIndex);
    let segmentText = selected.join("\n");
    const includesTrailingModelLine =
      endIndex === lines.length && selected[selected.length - 1] === "";
    if (segment.endsWithNewline && !includesTrailingModelLine) {
      segmentText += "\n";
    }
    return {
      fileName: segment.fileName,
      text: segmentText,
    };
  });
}

export function buildMultiFileWritePlan<TTarget extends PaneSaveTarget>(
  text: string,
  segments: readonly LineSegment[],
  targets: readonly TTarget[],
  options?: { sourceFiles?: readonly FileBytes[] },
): MultiFileWriteItem<TTarget>[] {
  const segmentTexts = extractSegmentTexts(text, segments);
  if (segmentTexts.length !== targets.length) {
    throw new Error("Cannot map editor text to every file.");
  }

  return targets.map((target, index) => {
    const segmentText = segmentTexts[index]?.text ?? "";
    const sourceFile = options?.sourceFiles?.[index];
    const sourceBytes =
      sourceFile?.name === target.fileName ? sourceFile.bytes : null;
    return {
      target,
      text: segmentText,
      bytes: buildPaneWriteBytesPreservingSource(segmentText, {
        resolvedEncoding: target.resolvedEncoding,
        includeUtf8Bom: target.includeUtf8Bom,
        lineEnding: target.lineEnding,
      }, sourceBytes),
    };
  });
}
