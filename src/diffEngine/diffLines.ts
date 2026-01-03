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

export function diffLinesFromLines(leftLines: string[], rightLines: string[]): LineOp[] {
  const trace = buildMyersTrace(leftLines, rightLines);
  return backtrackOps(leftLines, rightLines, trace);
}

export function diffLines(leftText: string, rightText: string): LineOp[] {
  const leftNormalized = normalizeText(leftText);
  const rightNormalized = normalizeText(rightText);
  const leftLines = splitLines(leftNormalized);
  const rightLines = splitLines(rightNormalized);

  return diffLinesFromLines(leftLines, rightLines);
}
