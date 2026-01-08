import type { PairedOp } from "../diffEngine/types";
import { mapRowToLineNumbers } from "../diffEngine/diffBlocks";
import type { LineSegment } from "../file/lineNumbering";

export type ViewZoneSpec = {
  afterLineNumber: number;
  heightInLines: number;
  className: string;
  label?: string;
};

type BoundaryInfo = {
  className: string;
  label: string;
};

type BoundarySide = "left" | "right";

function findRowIndexForLine(
  ops: PairedOp[],
  side: BoundarySide,
  lineNo: number,
): number | null {
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (side === "left" && op.leftLineNo === lineNo) {
      return index;
    }
    if (side === "right" && op.rightLineNo === lineNo) {
      return index;
    }
  }
  return null;
}

function buildBoundaryMap(
  ops: PairedOp[],
  segments: LineSegment[],
  side: BoundarySide,
): Map<number, BoundaryInfo> {
  const map = new Map<number, BoundaryInfo>();
  for (const segment of segments) {
    if (segment.startLine <= 1) {
      continue;
    }
    const lineNo = segment.startLine - 2;
    const rowIndex = findRowIndexForLine(ops, side, lineNo);
    if (rowIndex === null) {
      continue;
    }
    const paletteIndex = ((segment.fileIndex - 1) % 4) + 1;
    const label =
      segment.fileName && segment.fileName.length > 0
        ? `File ${segment.fileIndex}: ${segment.fileName}`
        : `File ${segment.fileIndex}`;
    map.set(rowIndex, {
      className: `file-boundary-zone file-index-${paletteIndex}`,
      label,
    });
  }
  return map;
}

export function buildAlignedFileBoundaryZones(
  ops: PairedOp[],
  leftSegments: LineSegment[],
  rightSegments: LineSegment[],
  gapLines = 3,
): { left: ViewZoneSpec[]; right: ViewZoneSpec[] } {
  const leftMap = buildBoundaryMap(ops, leftSegments, "left");
  const rightMap = buildBoundaryMap(ops, rightSegments, "right");
  const rowIndices = new Set<number>();
  leftMap.forEach((_value, key) => rowIndices.add(key));
  rightMap.forEach((_value, key) => rowIndices.add(key));

  const left: ViewZoneSpec[] = [];
  const right: ViewZoneSpec[] = [];
  const sortedRows = Array.from(rowIndices).sort((a, b) => a - b);

  for (const rowIndex of sortedRows) {
    const lineNumbers = mapRowToLineNumbers(ops, rowIndex);
    const leftInfo = leftMap.get(rowIndex);
    const rightInfo = rightMap.get(rowIndex);
    left.push({
      afterLineNumber: lineNumbers.leftLineNo,
      heightInLines: gapLines,
      className: leftInfo?.className ?? "file-boundary-zone",
      label: leftInfo?.label,
    });
    right.push({
      afterLineNumber: lineNumbers.rightLineNo,
      heightInLines: gapLines,
      className: rightInfo?.className ?? "file-boundary-zone",
      label: rightInfo?.label,
    });
  }

  return { left, right };
}
