import { normalizeText } from "./normalize";
import { diffLinesFromLines } from "./diffLines";
import { pairReplace } from "./pairReplace";
import type { LineOp, PairedOp } from "./types";

export type Anchor = {
  leftLineNo: number;
  rightLineNo: number;
};

export type AnchorValidationIssue = {
  anchor: Anchor;
  reasons: string[];
};

export type AnchorValidationResult = {
  valid: Anchor[];
  invalid: AnchorValidationIssue[];
};

function splitNormalizedLines(text: string): string[] {
  return normalizeText(text).split("\n");
}

function addReason(
  issues: Map<Anchor, Set<string>>,
  anchor: Anchor,
  reason: string,
) {
  const entry = issues.get(anchor) ?? new Set<string>();
  entry.add(reason);
  issues.set(anchor, entry);
}

export function validateAnchors(
  anchors: Anchor[],
  leftLineCount: number,
  rightLineCount: number,
): AnchorValidationResult {
  const issues = new Map<Anchor, Set<string>>();

  for (const anchor of anchors) {
    const outOfRange =
      anchor.leftLineNo < 0 ||
      anchor.rightLineNo < 0 ||
      anchor.leftLineNo >= leftLineCount ||
      anchor.rightLineNo >= rightLineCount;
    if (outOfRange) {
      addReason(issues, anchor, "範囲外");
    }
  }

  const leftCounts = new Map<number, number>();
  const rightCounts = new Map<number, number>();
  anchors.forEach((anchor) => {
    leftCounts.set(anchor.leftLineNo, (leftCounts.get(anchor.leftLineNo) ?? 0) + 1);
    rightCounts.set(anchor.rightLineNo, (rightCounts.get(anchor.rightLineNo) ?? 0) + 1);
  });

  for (const anchor of anchors) {
    if ((leftCounts.get(anchor.leftLineNo) ?? 0) > 1) {
      addReason(issues, anchor, "左行の重複");
    }
    if ((rightCounts.get(anchor.rightLineNo) ?? 0) > 1) {
      addReason(issues, anchor, "右行の重複");
    }
  }

  const sorted = [...anchors].sort((a, b) => a.leftLineNo - b.leftLineNo);
  let prevRight = -1;
  for (const anchor of sorted) {
    if (anchor.rightLineNo <= prevRight) {
      addReason(issues, anchor, "順序逆転");
    }
    if (anchor.rightLineNo > prevRight) {
      prevRight = anchor.rightLineNo;
    }
  }

  const invalid: AnchorValidationIssue[] = [];
  issues.forEach((reasons, anchor) => {
    invalid.push({ anchor, reasons: Array.from(reasons) });
  });

  const valid = sorted.filter((anchor) => !issues.has(anchor));

  return { valid, invalid };
}

function offsetOps(ops: PairedOp[], leftOffset: number, rightOffset: number): PairedOp[] {
  return ops.map((op) => {
    if (op.type === "insert") {
      return {
        ...op,
        rightLineNo:
          op.rightLineNo === undefined ? undefined : op.rightLineNo + rightOffset,
      };
    }
    if (op.type === "delete") {
      return {
        ...op,
        leftLineNo: op.leftLineNo === undefined ? undefined : op.leftLineNo + leftOffset,
      };
    }
    return {
      ...op,
      leftLineNo: op.leftLineNo === undefined ? undefined : op.leftLineNo + leftOffset,
      rightLineNo: op.rightLineNo === undefined ? undefined : op.rightLineNo + rightOffset,
    };
  });
}

function diffSegment(
  leftLines: string[],
  rightLines: string[],
  leftOffset: number,
  rightOffset: number,
): PairedOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }

  const ops: LineOp[] = diffLinesFromLines(leftLines, rightLines);
  const paired = pairReplace(ops);
  return offsetOps(paired, leftOffset, rightOffset);
}

export function diffWithAnchors(
  leftText: string,
  rightText: string,
  anchors: Anchor[],
): PairedOp[] {
  const leftLines = splitNormalizedLines(leftText);
  const rightLines = splitNormalizedLines(rightText);
  const result: PairedOp[] = [];
  let leftStart = 0;
  let rightStart = 0;

  for (const anchor of anchors) {
    const leftSegment = leftLines.slice(leftStart, anchor.leftLineNo);
    const rightSegment = rightLines.slice(rightStart, anchor.rightLineNo);
    result.push(...diffSegment(leftSegment, rightSegment, leftStart, rightStart));

    const leftLine = leftLines[anchor.leftLineNo] ?? "";
    const rightLine = rightLines[anchor.rightLineNo] ?? "";
    result.push({
      type: leftLine === rightLine ? "equal" : "replace",
      leftLine,
      rightLine,
      leftLineNo: anchor.leftLineNo,
      rightLineNo: anchor.rightLineNo,
    });

    leftStart = anchor.leftLineNo + 1;
    rightStart = anchor.rightLineNo + 1;
  }

  const tailLeft = leftLines.slice(leftStart);
  const tailRight = rightLines.slice(rightStart);
  result.push(...diffSegment(tailLeft, tailRight, leftStart, rightStart));

  return result;
}
