import { normalizeText } from "./normalize";
import type { LineOp } from "./types";
import { extractLineKey } from "./lineSignature";

function splitLines(text: string): string[] {
  // Keep trailing empty line if the text ends with "\n".
  return text.split("\n");
}

function normalizeForMatch(line: string): string {
  const trimmed = stripRazorLinePrefix(line).replace(/^\s+/, "");
  const initVar = extractInitVariable(trimmed);
  if (initVar) {
    return `init:${initVar}`;
  }
  const literal = extractFirstLiteral(trimmed);
  if (literal && isAppendLike(trimmed)) {
    return `append:${literal}`;
  }
  return trimmed;
}

function stripRazorLinePrefix(line: string): string {
  const match = line.match(/^(\s*)@:\s*/);
  if (!match) {
    return line;
  }
  return match[1] + line.slice(match[0].length);
}

function buildCompareLines(lines: string[]): string[] {
  return lines.map((line) => normalizeForMatch(line));
}

function extractFirstLiteral(line: string): string | null {
  const match = line.match(/'([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"/);
  if (!match) {
    return null;
  }
  return match[0].slice(1, -1).toLowerCase();
}

function isAppendLike(line: string): boolean {
  return /\.(?:append|appendline|appendformat)\s*\(/i.test(line) || /\.\=/.test(line);
}

function extractInitVariable(line: string): string | null {
  const csharpMatch = line.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*new\b/i);
  if (csharpMatch) {
    return csharpMatch[1].toLowerCase();
  }
  const phpMatch = line.match(/\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['"])\s*\2/);
  if (phpMatch) {
    return phpMatch[1].toLowerCase();
  }
  return null;
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

function backtrackOps(
  left: string[],
  right: string[],
  leftCompare: string[],
  rightCompare: string[],
  trace: MyersTrace,
): LineOp[] {
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

    // Diagonal moves are aligned lines based on compare keys.
    while (x > prevX && y > prevY) {
      const leftLine = left[x - 1];
      const rightLine = right[y - 1];
      const leftKey = leftCompare[x - 1];
      const rightKey = rightCompare[y - 1];
      if (leftLine === rightLine) {
        ops.push({
          type: "equal",
          leftLine,
          rightLine,
          leftLineNo: x - 1,
          rightLineNo: y - 1,
        });
      } else if (leftKey === rightKey) {
        ops.push({
          type: "insert",
          rightLine,
          rightLineNo: y - 1,
        });
        ops.push({
          type: "delete",
          leftLine,
          leftLineNo: x - 1,
        });
      } else {
        ops.push({
          type: "insert",
          rightLine,
          rightLineNo: y - 1,
        });
        ops.push({
          type: "delete",
          leftLine,
          leftLineNo: x - 1,
        });
      }
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

type LineKey = {
  key: string;
  index: number;
};

function buildKeyMap(lines: string[]): Map<string, LineKey & { count: number }> {
  const map = new Map<string, LineKey & { count: number }>();

  lines.forEach((line, index) => {
    const rawKey = extractLineKey(line);
    const key = rawKey ?? line.trimStart();
    const entry = map.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      map.set(key, { key, index, count: 1 });
    }
  });

  return map;
}

function buildUniquePairs(left: string[], right: string[]): UniquePair[] {
  const leftMap = buildKeyMap(left);
  const rightMap = buildKeyMap(right);

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
  leftCompare: string[],
  rightCompare: string[],
  leftOffset: number,
  rightOffset: number,
): LineOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }
  const trace = buildMyersTrace(leftCompare, rightCompare);
  const ops = backtrackOps(leftLines, rightLines, leftCompare, rightCompare, trace);
  return offsetOps(ops, leftOffset, rightOffset);
}

function diffLinesPatience(
  leftLines: string[],
  rightLines: string[],
  leftCompare: string[],
  rightCompare: string[],
  leftOffset: number,
  rightOffset: number,
): LineOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }

  const anchors = longestIncreasingPairs(buildUniquePairs(leftLines, rightLines));
  if (anchors.length === 0) {
    return diffLinesMyers(leftLines, rightLines, leftCompare, rightCompare, leftOffset, rightOffset);
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
        leftCompare.slice(leftStart, anchor.leftIndex),
        rightCompare.slice(rightStart, anchor.rightIndex),
        leftOffset + leftStart,
        rightOffset + rightStart,
      ),
    );

    const leftLine = leftLines[anchor.leftIndex] ?? "";
    const rightLine = rightLines[anchor.rightIndex] ?? "";
    const leftKey = leftCompare[anchor.leftIndex] ?? "";
    const rightKey = rightCompare[anchor.rightIndex] ?? "";
    if (leftLine === rightLine) {
      result.push({
        type: "equal",
        leftLine,
        rightLine,
        leftLineNo: leftOffset + anchor.leftIndex,
        rightLineNo: rightOffset + anchor.rightIndex,
      });
    } else if (leftKey === rightKey) {
      result.push({
        type: "delete",
        leftLine,
        leftLineNo: leftOffset + anchor.leftIndex,
      });
      result.push({
        type: "insert",
        rightLine,
        rightLineNo: rightOffset + anchor.rightIndex,
      });
    } else {
      result.push(
        ...diffLinesMyers(
          [leftLine],
          [rightLine],
          [leftKey],
          [rightKey],
          leftOffset + anchor.leftIndex,
          rightOffset + anchor.rightIndex,
        ),
      );
    }

    leftStart = anchor.leftIndex + 1;
    rightStart = anchor.rightIndex + 1;
  }

  const tailLeft = leftLines.slice(leftStart);
  const tailRight = rightLines.slice(rightStart);
  result.push(
    ...diffLinesPatience(
      tailLeft,
      tailRight,
      leftCompare.slice(leftStart),
      rightCompare.slice(rightStart),
      leftOffset + leftStart,
      rightOffset + rightStart,
    ),
  );

  return result;
}

export function diffLinesFromLines(leftLines: string[], rightLines: string[]): LineOp[] {
  const leftCompare = buildCompareLines(leftLines);
  const rightCompare = buildCompareLines(rightLines);
  return diffLinesPatience(leftLines, rightLines, leftCompare, rightCompare, 0, 0);
}

export function diffLines(leftText: string, rightText: string): LineOp[] {
  const leftNormalized = normalizeText(leftText);
  const rightNormalized = normalizeText(rightText);
  const leftLines = splitLines(leftNormalized);
  const rightLines = splitLines(rightNormalized);

  return diffLinesFromLines(leftLines, rightLines);
}
