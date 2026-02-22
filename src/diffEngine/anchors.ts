import { normalizeText } from "./normalize";
import { diffLinesFromLines, type DiffLinesOptions } from "./diffLines";
import { pairReplace } from "./pairReplace";
import { extractAppendLiteralInlineMap } from "./appendLiteral";
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

export function addAnchor(anchors: Anchor[], anchor: Anchor): Anchor[] {
  return [...anchors, anchor];
}

export function removeAnchorByLeft(
  anchors: Anchor[],
  leftLineNo: number,
): { next: Anchor[]; removed?: Anchor } {
  const index = anchors.findIndex((anchor) => anchor.leftLineNo === leftLineNo);
  if (index === -1) {
    return { next: anchors };
  }
  const removed = anchors[index];
  const next = anchors.slice(0, index).concat(anchors.slice(index + 1));
  return { next, removed };
}

export function removeAnchorByRight(
  anchors: Anchor[],
  rightLineNo: number,
): { next: Anchor[]; removed?: Anchor } {
  const index = anchors.findIndex((anchor) => anchor.rightLineNo === rightLineNo);
  if (index === -1) {
    return { next: anchors };
  }
  const removed = anchors[index];
  const next = anchors.slice(0, index).concat(anchors.slice(index + 1));
  return { next, removed };
}

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
  options: DiffLinesOptions,
): PairedOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }

  const ops: LineOp[] = diffLinesFromLines(leftLines, rightLines, {
    ignoreLeadingFileWhitespace: options.ignoreLeadingFileWhitespace === true,
  });
  const paired = pairReplace(ops);
  return offsetOps(paired, leftOffset, rightOffset);
}

function stripLeadingTabsAndSpaces(value: string): string {
  return value.replace(/^[ \t]+/, "");
}

function hasOnlyLeadingFileWhitespaceDifferenceInAppendPayload(
  leftLine: string,
  rightLine: string,
): boolean {
  const leftMap = extractAppendLiteralInlineMap(leftLine);
  const rightMap = extractAppendLiteralInlineMap(rightLine);
  if (!leftMap || !rightMap) {
    return false;
  }
  const leftWrapper = leftLine.slice(0, leftMap.payloadRange.start) + leftLine.slice(leftMap.payloadRange.end);
  const rightWrapper =
    rightLine.slice(0, rightMap.payloadRange.start) + rightLine.slice(rightMap.payloadRange.end);
  if (leftWrapper !== rightWrapper) {
    return false;
  }
  if (leftMap.payload === rightMap.payload) {
    return false;
  }
  return stripLeadingTabsAndSpaces(leftMap.payload) === stripLeadingTabsAndSpaces(rightMap.payload);
}

function isSameLineForMatch(
  leftLine: string,
  rightLine: string,
  leftLineNo: number,
  rightLineNo: number,
  options: DiffLinesOptions,
  leftLeadingFileWhitespaceEligible: boolean,
  rightLeadingFileWhitespaceEligible: boolean,
): boolean {
  void leftLineNo;
  void rightLineNo;
  void leftLeadingFileWhitespaceEligible;
  void rightLeadingFileWhitespaceEligible;
  if (leftLine === rightLine) {
    return true;
  }
  if (!options.ignoreLeadingFileWhitespace) {
    return false;
  }
  if (stripLeadingTabsAndSpaces(leftLine) === stripLeadingTabsAndSpaces(rightLine)) {
    return true;
  }
  return hasOnlyLeadingFileWhitespaceDifferenceInAppendPayload(leftLine, rightLine);
}

export function diffWithAnchors(
  leftText: string,
  rightText: string,
  anchors: Anchor[],
  options: DiffLinesOptions = {},
): PairedOp[] {
  const leftNormalized = normalizeText(leftText);
  const rightNormalized = normalizeText(rightText);
  const leftLines = leftNormalized.split("\n");
  const rightLines = rightNormalized.split("\n");
  const leftLeadingFileWhitespaceEligible =
    leftNormalized.length === 0 || leftNormalized[0] !== "\n";
  const rightLeadingFileWhitespaceEligible =
    rightNormalized.length === 0 || rightNormalized[0] !== "\n";
  const result: PairedOp[] = [];
  let leftStart = 0;
  let rightStart = 0;

  for (const anchor of anchors) {
    const leftSegment = leftLines.slice(leftStart, anchor.leftLineNo);
    const rightSegment = rightLines.slice(rightStart, anchor.rightLineNo);
    result.push(...diffSegment(leftSegment, rightSegment, leftStart, rightStart, options));

    const leftLine = leftLines[anchor.leftLineNo] ?? "";
    const rightLine = rightLines[anchor.rightLineNo] ?? "";
    result.push({
      type: isSameLineForMatch(
        leftLine,
        rightLine,
        anchor.leftLineNo,
        anchor.rightLineNo,
        options,
        leftLeadingFileWhitespaceEligible,
        rightLeadingFileWhitespaceEligible,
      )
        ? "equal"
        : "replace",
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
  result.push(...diffSegment(tailLeft, tailRight, leftStart, rightStart, options));

  return result;
}
