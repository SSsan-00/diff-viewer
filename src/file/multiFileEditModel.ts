import type { LineChange, LineSegment } from "./lineNumbering";
import {
  buildPaneWriteBytes,
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

function findSegmentIndexAtLine(
  segments: readonly LineSegment[],
  lineNumber: number,
): number {
  return segments.findIndex((segment) => {
    const endLine = segment.startLine + segment.lineCount - 1;
    return lineNumber >= segment.startLine && lineNumber <= endLine;
  });
}

export function areChangesWithinSingleFileSegments(
  segments: readonly LineSegment[],
  changes: readonly LineChange[],
): boolean {
  if (segments.length <= 1) {
    return true;
  }

  return changes.every((change) => {
    const startIndex = findSegmentIndexAtLine(
      segments,
      change.range.startLineNumber,
    );
    const endIndex = findSegmentIndexAtLine(segments, change.range.endLineNumber);
    return startIndex >= 0 && startIndex === endIndex;
  });
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
    if (segment.endsWithNewline && selected[selected.length - 1] !== "") {
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
): MultiFileWriteItem<TTarget>[] {
  const segmentTexts = extractSegmentTexts(text, segments);
  if (segmentTexts.length !== targets.length) {
    throw new Error("Cannot map editor text to every file.");
  }

  return targets.map((target, index) => {
    const segmentText = segmentTexts[index]?.text ?? "";
    return {
      target,
      text: segmentText,
      bytes: buildPaneWriteBytes(segmentText, {
        resolvedEncoding: target.resolvedEncoding,
        includeUtf8Bom: target.includeUtf8Bom,
        lineEnding: target.lineEnding,
      }),
    };
  });
}
