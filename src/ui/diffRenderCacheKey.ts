import type { PairedOp } from "../diffEngine/types";
import type { LineSegment } from "../file/lineNumbering";

export function buildPairedOpsSignature(ops: readonly PairedOp[]): string {
  return JSON.stringify(
    ops.map((op) => [
      op.type,
      op.diffVisible !== false,
      op.leftLineNo ?? null,
      op.rightLineNo ?? null,
      op.leftLine ?? null,
      op.rightLine ?? null,
    ]),
  );
}

export function buildSegmentsSignature(segments: readonly LineSegment[]): string {
  return JSON.stringify(
    segments.map((segment) => [
      segment.fileIndex,
      segment.fileName ?? null,
      segment.startLine,
      segment.lineCount,
    ]),
  );
}
