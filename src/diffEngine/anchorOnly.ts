import { normalizeText } from "./normalize";
import type { Anchor } from "./anchors";
import type { PairedOp } from "./types";

function splitNormalizedLines(text: string): string[] {
  return normalizeText(text).split("\n");
}

function pushNeutralSegment(
  result: PairedOp[],
  leftLines: string[],
  rightLines: string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
) {
  const leftCount = Math.max(0, leftEnd - leftStart);
  const rightCount = Math.max(0, rightEnd - rightStart);
  const pairedCount = Math.min(leftCount, rightCount);

  for (let index = 0; index < pairedCount; index += 1) {
    const leftLineNo = leftStart + index;
    const rightLineNo = rightStart + index;
    result.push({
      type: "equal",
      diffVisible: false,
      leftLine: leftLines[leftLineNo] ?? "",
      rightLine: rightLines[rightLineNo] ?? "",
      leftLineNo,
      rightLineNo,
    });
  }

  for (let index = pairedCount; index < leftCount; index += 1) {
    const leftLineNo = leftStart + index;
    result.push({
      type: "delete",
      diffVisible: false,
      leftLine: leftLines[leftLineNo] ?? "",
      leftLineNo,
    });
  }

  for (let index = pairedCount; index < rightCount; index += 1) {
    const rightLineNo = rightStart + index;
    result.push({
      type: "insert",
      diffVisible: false,
      rightLine: rightLines[rightLineNo] ?? "",
      rightLineNo,
    });
  }
}

export function buildAnchorOnlyPairedOps(
  leftText: string,
  rightText: string,
  anchors: readonly Anchor[],
): PairedOp[] {
  const leftLines = splitNormalizedLines(leftText);
  const rightLines = splitNormalizedLines(rightText);
  const result: PairedOp[] = [];
  let leftStart = 0;
  let rightStart = 0;

  const sortedAnchors = [...anchors].sort((a, b) => a.leftLineNo - b.leftLineNo);

  for (const anchor of sortedAnchors) {
    pushNeutralSegment(
      result,
      leftLines,
      rightLines,
      leftStart,
      anchor.leftLineNo,
      rightStart,
      anchor.rightLineNo,
    );

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

  pushNeutralSegment(
    result,
    leftLines,
    rightLines,
    leftStart,
    leftLines.length,
    rightStart,
    rightLines.length,
  );

  return result;
}
