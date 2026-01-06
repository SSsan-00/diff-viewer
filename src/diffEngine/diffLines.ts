import { normalizeText } from "./normalize";
import type { LineOp } from "./types";

function splitLines(text: string): string[] {
  // Keep trailing empty line if the text ends with "\n".
  return text.split("\n");
}

type MyersTrace = number[][];

function buildMyersTrace(left: string[], right: string[]): MyersTrace {
  const n = left.length;
  const m = right.length;
  const max = n + m;
  const offset = max;
  const v = new Array(2 * max + 1).fill(0);
  const trace: MyersTrace = [];
  let found = false;

  for (let d = 0; d <= max; d += 1) {
    for (let k = -d; k <= d; k += 2) {
      const kIndex = k + offset;
      let x: number;

      // Choose whether to move down (insert) or right (delete).
      if (k === -d || (k !== d && v[kIndex - 1] < v[kIndex + 1])) {
        x = v[kIndex + 1];
      } else {
        x = v[kIndex - 1] + 1;
      }

      let y = x - k;

      // Follow diagonals while lines match.
      while (x < n && y < m && left[x] === right[y]) {
        x += 1;
        y += 1;
      }

      v[kIndex] = x;

      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }

    trace.push(v.slice());
    if (found) {
      break;
    }
  }

  return trace;
}

function backtrackOps(left: string[], right: string[], trace: MyersTrace): LineOp[] {
  const n = left.length;
  const m = right.length;
  const max = n + m;
  const offset = max;
  const ops: LineOp[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const v = trace[d];
    const k = x - y;
    const kIndex = k + offset;
    let prevK: number;

    // Mirror the forward decision to find the previous step.
    if (k === -d || (k !== d && v[kIndex - 1] < v[kIndex + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[prevK + offset];
    const prevY = prevX - prevK;

    // Diagonal moves are equal lines.
    while (x > prevX && y > prevY) {
      ops.push({
        type: "equal",
        leftLine: left[x - 1],
        rightLine: right[y - 1],
        leftLineNo: x - 1,
        rightLineNo: y - 1,
      });
      x -= 1;
      y -= 1;
    }

    if (d === 0) {
      break;
    }

    // Horizontal move is delete, vertical move is insert.
    if (x === prevX) {
      ops.push({
        type: "insert",
        rightLine: right[y - 1],
        rightLineNo: y - 1,
      });
      y -= 1;
    } else {
      ops.push({
        type: "delete",
        leftLine: left[x - 1],
        leftLineNo: x - 1,
      });
      x -= 1;
    }
  }

  return ops.reverse();
}

type UniquePair = {
  leftIndex: number;
  rightIndex: number;
};

function buildUniquePairs(left: string[], right: string[]): UniquePair[] {
  const leftMap = new Map<string, { count: number; index: number }>();
  const rightMap = new Map<string, { count: number; index: number }>();

  left.forEach((line, index) => {
    const entry = leftMap.get(line);
    if (entry) {
      entry.count += 1;
    } else {
      leftMap.set(line, { count: 1, index });
    }
  });

  right.forEach((line, index) => {
    const entry = rightMap.get(line);
    if (entry) {
      entry.count += 1;
    } else {
      rightMap.set(line, { count: 1, index });
    }
  });

  const pairs: UniquePair[] = [];
  leftMap.forEach((leftEntry, line) => {
    if (leftEntry.count !== 1) {
      return;
    }
    const rightEntry = rightMap.get(line);
    if (!rightEntry || rightEntry.count !== 1) {
      return;
    }
    pairs.push({ leftIndex: leftEntry.index, rightIndex: rightEntry.index });
  });

  return pairs.sort((a, b) => a.leftIndex - b.leftIndex);
}

function longestIncreasingPairs(pairs: UniquePair[]): UniquePair[] {
  if (pairs.length === 0) {
    return [];
  }

  const tailValues: number[] = [];
  const tailIndices: number[] = [];
  const prevIndices = new Array<number>(pairs.length).fill(-1);

  const lowerBound = (value: number) => {
    let low = 0;
    let high = tailValues.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (tailValues[mid] < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  };

  for (let i = 0; i < pairs.length; i += 1) {
    const value = pairs[i].rightIndex;
    const pos = lowerBound(value);

    if (pos === tailValues.length) {
      tailValues.push(value);
      tailIndices.push(i);
    } else {
      tailValues[pos] = value;
      tailIndices[pos] = i;
    }

    if (pos > 0) {
      prevIndices[i] = tailIndices[pos - 1];
    }
  }

  let k = tailIndices[tailIndices.length - 1];
  const sequence: UniquePair[] = [];
  while (k >= 0) {
    sequence.push(pairs[k]);
    k = prevIndices[k];
  }

  return sequence.reverse();
}

function offsetOps(ops: LineOp[], leftOffset: number, rightOffset: number): LineOp[] {
  return ops.map((op) => {
    if (op.type === "delete") {
      return {
        ...op,
        leftLineNo: op.leftLineNo === undefined ? undefined : op.leftLineNo + leftOffset,
      };
    }
    if (op.type === "insert") {
      return {
        ...op,
        rightLineNo: op.rightLineNo === undefined ? undefined : op.rightLineNo + rightOffset,
      };
    }
    return {
      ...op,
      leftLineNo: op.leftLineNo === undefined ? undefined : op.leftLineNo + leftOffset,
      rightLineNo: op.rightLineNo === undefined ? undefined : op.rightLineNo + rightOffset,
    };
  });
}

function diffLinesMyers(
  leftLines: string[],
  rightLines: string[],
  leftOffset: number,
  rightOffset: number,
): LineOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }
  const trace = buildMyersTrace(leftLines, rightLines);
  const ops = backtrackOps(leftLines, rightLines, trace);
  return offsetOps(ops, leftOffset, rightOffset);
}

function diffLinesPatience(
  leftLines: string[],
  rightLines: string[],
  leftOffset: number,
  rightOffset: number,
): LineOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }

  const anchors = longestIncreasingPairs(buildUniquePairs(leftLines, rightLines));
  if (anchors.length === 0) {
    return diffLinesMyers(leftLines, rightLines, leftOffset, rightOffset);
  }

  const result: LineOp[] = [];
  let leftStart = 0;
  let rightStart = 0;

  for (const anchor of anchors) {
    const leftSegment = leftLines.slice(leftStart, anchor.leftIndex);
    const rightSegment = rightLines.slice(rightStart, anchor.rightIndex);
    result.push(
      ...diffLinesPatience(
        leftSegment,
        rightSegment,
        leftOffset + leftStart,
        rightOffset + rightStart,
      ),
    );

    result.push({
      type: "equal",
      leftLine: leftLines[anchor.leftIndex],
      rightLine: rightLines[anchor.rightIndex],
      leftLineNo: leftOffset + anchor.leftIndex,
      rightLineNo: rightOffset + anchor.rightIndex,
    });

    leftStart = anchor.leftIndex + 1;
    rightStart = anchor.rightIndex + 1;
  }

  const tailLeft = leftLines.slice(leftStart);
  const tailRight = rightLines.slice(rightStart);
  result.push(
    ...diffLinesPatience(
      tailLeft,
      tailRight,
      leftOffset + leftStart,
      rightOffset + rightStart,
    ),
  );

  return result;
}

export function diffLinesFromLines(leftLines: string[], rightLines: string[]): LineOp[] {
  return diffLinesPatience(leftLines, rightLines, 0, 0);
}

export function diffLines(leftText: string, rightText: string): LineOp[] {
  const leftNormalized = normalizeText(leftText);
  const rightNormalized = normalizeText(rightText);
  const leftLines = splitLines(leftNormalized);
  const rightLines = splitLines(rightNormalized);

  return diffLinesFromLines(leftLines, rightLines);
}
