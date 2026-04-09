import { normalizeText } from "./normalize";
import type { LineOp } from "./types";
import { extractLineKey } from "./lineSignature";
import { toAppendLiteralOrLine } from "./appendLiteral";
import { extractAppendLiteral } from "./appendLiteral";
import { extractAppendLiteralInlineMap } from "./appendLiteral";
import { extractEmbeddedOutputCall } from "./embeddedOutputCall";

export type DiffLinesOptions = {
  ignoreLeadingFileWhitespace?: boolean;
  leftLeadingFileWhitespaceEligible?: boolean;
  rightLeadingFileWhitespaceEligible?: boolean;
};

type ResolvedDiffLinesOptions = {
  ignoreLeadingFileWhitespace: boolean;
  leftLeadingFileWhitespaceEligible: boolean;
  rightLeadingFileWhitespaceEligible: boolean;
};

function splitLines(text: string): string[] {
  // Keep trailing empty line if the text ends with "\n".
  return text.split("\n");
}

function normalizeForMatch(line: string): string {
  const trimmed = stripRazorLinePrefix(line).replace(/^\s+/, "");
  if (isBlankLine(trimmed)) {
    return "";
  }
  const embeddedOutputCall = extractEmbeddedOutputCall(trimmed);
  if (embeddedOutputCall) {
    return `embeddedcall:${embeddedOutputCall}`;
  }
  const initVar = extractInitVariable(trimmed);
  if (initVar) {
    return `init:${initVar}`;
  }
  const appendLiteral = isAppendLike(trimmed) ? extractAppendLiteral(trimmed) : null;
  if (appendLiteral) {
    return `append:${appendLiteral.toLowerCase()}`;
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

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function buildCompareLines(lines: string[]): string[] {
  return lines.map((line) => normalizeForMatch(line));
}

function stripLeadingTabsAndSpaces(value: string): string {
  return value.replace(/^[ \t]+/, "");
}

function adjustLeadingFileWhitespaceCompareKey(value: string): string {
  if (value.startsWith("append:")) {
    return `append:${stripLeadingTabsAndSpaces(value.slice("append:".length))}`;
  }
  return stripLeadingTabsAndSpaces(value);
}

function buildCompareLinesWithOptions(
  lines: string[],
  options: ResolvedDiffLinesOptions,
): string[] {
  const compare = buildCompareLines(lines);
  if (!options.ignoreLeadingFileWhitespace || compare.length === 0) {
    return compare;
  }
  return compare.map((value) => adjustLeadingFileWhitespaceCompareKey(value));
}

function canIgnoreLeadingFileWhitespaceFromText(text: string): boolean {
  if (text.length === 0) {
    return true;
  }
  return text[0] !== "\n";
}

function canIgnoreLeadingFileWhitespaceFromLines(lines: string[]): boolean {
  if (lines.length === 0) {
    return true;
  }
  // `[""]` can mean empty text or leading newline. Without original text we choose conservative.
  return (lines[0] ?? "") !== "";
}

function normalizeDiffLinesOptionsForLines(
  leftLines: string[],
  rightLines: string[],
  options: DiffLinesOptions,
): ResolvedDiffLinesOptions {
  return {
    ignoreLeadingFileWhitespace: options.ignoreLeadingFileWhitespace === true,
    leftLeadingFileWhitespaceEligible:
      options.leftLeadingFileWhitespaceEligible ??
      canIgnoreLeadingFileWhitespaceFromLines(leftLines),
    rightLeadingFileWhitespaceEligible:
      options.rightLeadingFileWhitespaceEligible ??
      canIgnoreLeadingFileWhitespaceFromLines(rightLines),
  };
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

function isIgnorableLeadingFileWhitespaceDiff(
  leftLine: string,
  rightLine: string,
  options: ResolvedDiffLinesOptions,
): boolean {
  if (!options.ignoreLeadingFileWhitespace) {
    return false;
  }
  if (leftLine === rightLine) {
    return false;
  }
  if (stripLeadingTabsAndSpaces(leftLine) === stripLeadingTabsAndSpaces(rightLine)) {
    return true;
  }
  return hasOnlyLeadingFileWhitespaceDifferenceInAppendPayload(leftLine, rightLine);
}

function extractFirstLiteral(line: string): string | null {
  const match = line.match(/'([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"/);
  if (!match) {
    return null;
  }
  return match[0].slice(1, -1).replace(/\s+/g, " ").toLowerCase();
}

function hasStringLiteral(line: string): boolean {
  return /'([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"/.test(line);
}

function isAppendLike(line: string): boolean {
  return (
    /\.(?:append|appendline|appendformat)\s*\(/i.test(line) ||
    /\.\=/.test(line) ||
    (/\+=/.test(line) && hasStringLiteral(line))
  );
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
type MyersBisect = {
  leftMid: number;
  rightMid: number;
};

const MYERS_TRACE_SAFE_LENGTH_SUM = 256;

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

function buildMatchedLineOps(
  leftLine: string,
  rightLine: string,
  leftLineNo: number,
  rightLineNo: number,
  options: ResolvedDiffLinesOptions,
): LineOp[] {
  if (leftLine === rightLine) {
    return [{
      type: "equal",
      leftLine,
      rightLine,
      leftLineNo,
      rightLineNo,
    }];
  }
  if (isBlankLine(leftLine) && isBlankLine(rightLine)) {
    return [{
      type: "equal",
      leftLine,
      rightLine,
      leftLineNo,
      rightLineNo,
    }];
  }
  if (
    isIgnorableLeadingFileWhitespaceDiff(
      leftLine,
      rightLine,
      options,
    )
  ) {
    return [{
      type: "equal",
      leftLine,
      rightLine,
      leftLineNo,
      rightLineNo,
    }];
  }
  return [
    {
      type: "delete",
      leftLine,
      leftLineNo,
    },
    {
      type: "insert",
      rightLine,
      rightLineNo,
    },
  ];
}

function buildDeleteOps(
  leftLines: string[],
  leftStart: number,
  leftEnd: number,
  leftOffset: number,
): LineOp[] {
  const ops: LineOp[] = [];
  for (let index = leftStart; index < leftEnd; index += 1) {
    ops.push({
      type: "delete",
      leftLine: leftLines[index],
      leftLineNo: leftOffset + index,
    });
  }
  return ops;
}

function buildInsertOps(
  rightLines: string[],
  rightStart: number,
  rightEnd: number,
  rightOffset: number,
): LineOp[] {
  const ops: LineOp[] = [];
  for (let index = rightStart; index < rightEnd; index += 1) {
    ops.push({
      type: "insert",
      rightLine: rightLines[index],
      rightLineNo: rightOffset + index,
    });
  }
  return ops;
}

function backtrackOps(
  left: string[],
  right: string[],
  trace: MyersTrace,
  leftOffset: number,
  rightOffset: number,
  options: ResolvedDiffLinesOptions,
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
      const globalLeftLineNo = leftOffset + (x - 1);
      const globalRightLineNo = rightOffset + (y - 1);
      const matchedOps = buildMatchedLineOps(
        leftLine,
        rightLine,
        globalLeftLineNo,
        globalRightLineNo,
        options,
      );
      for (let index = matchedOps.length - 1; index >= 0; index -= 1) {
        const op = matchedOps[index];
        if (op.type === "equal") {
          ops.push({
            ...op,
            leftLineNo: x - 1,
            rightLineNo: y - 1,
          });
          continue;
        }
        if (op.type === "delete") {
          ops.push({
            ...op,
            leftLineNo: x - 1,
          });
          continue;
        }
        ops.push({
          ...op,
          rightLineNo: y - 1,
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

function shouldUseMyersTrace(leftLength: number, rightLength: number): boolean {
  return leftLength + rightLength <= MYERS_TRACE_SAFE_LENGTH_SUM;
}

function findMyersBisect(
  leftCompare: string[],
  rightCompare: string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): MyersBisect {
  const leftLength = leftEnd - leftStart;
  const rightLength = rightEnd - rightStart;
  const maxD = Math.ceil((leftLength + rightLength) / 2);
  const vOffset = maxD;
  const vLength = 2 * maxD + 2;
  const forward = new Int32Array(vLength).fill(-1);
  const reverse = new Int32Array(vLength).fill(-1);
  const delta = leftLength - rightLength;
  const front = delta % 2 !== 0;

  forward[vOffset + 1] = 0;
  reverse[vOffset + 1] = 0;

  let forwardStart = 0;
  let forwardEnd = 0;
  let reverseStart = 0;
  let reverseEnd = 0;

  for (let d = 0; d <= maxD; d += 1) {
    for (let k = -d + forwardStart; k <= d - forwardEnd; k += 2) {
      const kOffset = vOffset + k;
      let x;

      if (k === -d || (k !== d && forward[kOffset - 1] < forward[kOffset + 1])) {
        x = forward[kOffset + 1];
      } else {
        x = forward[kOffset - 1] + 1;
      }

      let y = x - k;
      while (
        x < leftLength &&
        y < rightLength &&
        leftCompare[leftStart + x] === rightCompare[rightStart + y]
      ) {
        x += 1;
        y += 1;
      }

      forward[kOffset] = x;

      if (x > leftLength) {
        forwardEnd += 2;
      } else if (y > rightLength) {
        forwardStart += 2;
      } else if (front) {
        const reverseOffset = vOffset + delta - k;
        if (reverseOffset >= 0 && reverseOffset < vLength && reverse[reverseOffset] !== -1) {
          const reverseX = leftLength - reverse[reverseOffset];
          if (x >= reverseX) {
            return {
              leftMid: leftStart + x,
              rightMid: rightStart + y,
            };
          }
        }
      }
    }

    for (let k = -d + reverseStart; k <= d - reverseEnd; k += 2) {
      const kOffset = vOffset + k;
      let x;

      if (k === -d || (k !== d && reverse[kOffset - 1] < reverse[kOffset + 1])) {
        x = reverse[kOffset + 1];
      } else {
        x = reverse[kOffset - 1] + 1;
      }

      let y = x - k;
      while (
        x < leftLength &&
        y < rightLength &&
        leftCompare[leftEnd - x - 1] === rightCompare[rightEnd - y - 1]
      ) {
        x += 1;
        y += 1;
      }

      reverse[kOffset] = x;

      if (x > leftLength) {
        reverseEnd += 2;
      } else if (y > rightLength) {
        reverseStart += 2;
      } else if (!front) {
        const forwardOffset = vOffset + delta - k;
        if (forwardOffset >= 0 && forwardOffset < vLength && forward[forwardOffset] !== -1) {
          const forwardX = forward[forwardOffset];
          const forwardK = forwardOffset - vOffset;
          const forwardY = forwardX - forwardK;
          const reverseX = leftLength - x;
          if (forwardX >= reverseX) {
            return {
              leftMid: leftStart + forwardX,
              rightMid: rightStart + forwardY,
            };
          }
        }
      }
    }
  }

  return {
    leftMid: leftStart + Math.floor(leftLength / 2),
    rightMid: rightStart + Math.floor(rightLength / 2),
  };
}

function hasSharedCompareKey(
  leftCompare: string[],
  rightCompare: string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  const leftLength = leftEnd - leftStart;
  const rightLength = rightEnd - rightStart;
  const scanLeftFirst = leftLength <= rightLength;
  const smallerStart = scanLeftFirst ? leftStart : rightStart;
  const smallerEnd = scanLeftFirst ? leftEnd : rightEnd;
  const smallerSource = scanLeftFirst ? leftCompare : rightCompare;
  const largerStart = scanLeftFirst ? rightStart : leftStart;
  const largerEnd = scanLeftFirst ? rightEnd : leftEnd;
  const largerSource = scanLeftFirst ? rightCompare : leftCompare;
  const keys = new Set<string>();

  for (let index = smallerStart; index < smallerEnd; index += 1) {
    keys.add(smallerSource[index]);
  }
  for (let index = largerStart; index < largerEnd; index += 1) {
    if (keys.has(largerSource[index])) {
      return true;
    }
  }
  return false;
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
    const compareLine = toAppendLiteralOrLine(line);
    const rawKey = extractLineKey(compareLine);
    const key = rawKey ?? compareLine.trimStart();
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
  options: ResolvedDiffLinesOptions,
): LineOp[] {
  function diffRange(
    leftStart: number,
    leftEnd: number,
    rightStart: number,
    rightEnd: number,
  ): LineOp[] {
    const prefix: LineOp[] = [];
    let nextLeftStart = leftStart;
    let nextRightStart = rightStart;

    while (
      nextLeftStart < leftEnd &&
      nextRightStart < rightEnd &&
      leftCompare[nextLeftStart] === rightCompare[nextRightStart]
    ) {
      prefix.push(
        ...buildMatchedLineOps(
          leftLines[nextLeftStart],
          rightLines[nextRightStart],
          leftOffset + nextLeftStart,
          rightOffset + nextRightStart,
          options,
        ),
      );
      nextLeftStart += 1;
      nextRightStart += 1;
    }

    const suffixPairs: Array<{ leftIndex: number; rightIndex: number }> = [];
    let nextLeftEnd = leftEnd;
    let nextRightEnd = rightEnd;

    while (
      nextLeftStart < nextLeftEnd &&
      nextRightStart < nextRightEnd &&
      leftCompare[nextLeftEnd - 1] === rightCompare[nextRightEnd - 1]
    ) {
      nextLeftEnd -= 1;
      nextRightEnd -= 1;
      suffixPairs.push({
        leftIndex: nextLeftEnd,
        rightIndex: nextRightEnd,
      });
    }

    const leftLength = nextLeftEnd - nextLeftStart;
    const rightLength = nextRightEnd - nextRightStart;

    let middle: LineOp[];
    if (leftLength === 0) {
      middle = buildInsertOps(rightLines, nextRightStart, nextRightEnd, rightOffset);
    } else if (rightLength === 0) {
      middle = buildDeleteOps(leftLines, nextLeftStart, nextLeftEnd, leftOffset);
    } else if (
      !hasSharedCompareKey(
        leftCompare,
        rightCompare,
        nextLeftStart,
        nextLeftEnd,
        nextRightStart,
        nextRightEnd,
      )
    ) {
      middle = buildDeleteOps(leftLines, nextLeftStart, nextLeftEnd, leftOffset).concat(
        buildInsertOps(rightLines, nextRightStart, nextRightEnd, rightOffset),
      );
    } else if (shouldUseMyersTrace(leftLength, rightLength)) {
      const trace = buildMyersTrace(
        leftCompare.slice(nextLeftStart, nextLeftEnd),
        rightCompare.slice(nextRightStart, nextRightEnd),
      );
      middle = offsetOps(
        backtrackOps(
          leftLines.slice(nextLeftStart, nextLeftEnd),
          rightLines.slice(nextRightStart, nextRightEnd),
          trace,
          nextLeftStart,
          nextRightStart,
          options,
        ),
        leftOffset,
        rightOffset,
      );
    } else {
      const split = findMyersBisect(
        leftCompare,
        rightCompare,
        nextLeftStart,
        nextLeftEnd,
        nextRightStart,
        nextRightEnd,
      );
      if (split.leftMid === nextLeftStart && split.rightMid === nextRightStart) {
        middle = leftLength >= rightLength
          ? [
              {
                type: "delete",
                leftLine: leftLines[nextLeftStart],
                leftLineNo: leftOffset + nextLeftStart,
              },
              ...diffRange(nextLeftStart + 1, nextLeftEnd, nextRightStart, nextRightEnd),
            ]
          : [
              {
                type: "insert",
                rightLine: rightLines[nextRightStart],
                rightLineNo: rightOffset + nextRightStart,
              },
              ...diffRange(nextLeftStart, nextLeftEnd, nextRightStart + 1, nextRightEnd),
            ];
      } else if (split.leftMid === nextLeftEnd && split.rightMid === nextRightEnd) {
        middle = leftLength >= rightLength
          ? [
              ...diffRange(nextLeftStart, nextLeftEnd - 1, nextRightStart, nextRightEnd),
              {
                type: "delete",
                leftLine: leftLines[nextLeftEnd - 1],
                leftLineNo: leftOffset + nextLeftEnd - 1,
              },
            ]
          : [
              ...diffRange(nextLeftStart, nextLeftEnd, nextRightStart, nextRightEnd - 1),
              {
                type: "insert",
                rightLine: rightLines[nextRightEnd - 1],
                rightLineNo: rightOffset + nextRightEnd - 1,
              },
            ];
      } else {
        middle = diffRange(nextLeftStart, split.leftMid, nextRightStart, split.rightMid).concat(
          diffRange(split.leftMid, nextLeftEnd, split.rightMid, nextRightEnd),
        );
      }
    }

    const suffix: LineOp[] = [];
    for (let index = suffixPairs.length - 1; index >= 0; index -= 1) {
      const pair = suffixPairs[index];
      suffix.push(
        ...buildMatchedLineOps(
          leftLines[pair.leftIndex],
          rightLines[pair.rightIndex],
          leftOffset + pair.leftIndex,
          rightOffset + pair.rightIndex,
          options,
        ),
      );
    }

    return prefix.concat(middle, suffix);
  }

  return diffRange(0, leftLines.length, 0, rightLines.length);
}

function diffLinesPatience(
  leftLines: string[],
  rightLines: string[],
  leftCompare: string[],
  rightCompare: string[],
  leftOffset: number,
  rightOffset: number,
  options: ResolvedDiffLinesOptions,
): LineOp[] {
  if (leftLines.length === 0 && rightLines.length === 0) {
    return [];
  }

  const anchors = longestIncreasingPairs(buildUniquePairs(leftLines, rightLines));
  if (anchors.length === 0) {
    return diffLinesMyers(
      leftLines,
      rightLines,
      leftCompare,
      rightCompare,
      leftOffset,
      rightOffset,
      options,
    );
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
        options,
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
    } else if (
      leftKey === rightKey &&
      isBlankLine(leftLine) &&
      isBlankLine(rightLine)
    ) {
      result.push({
        type: "equal",
        leftLine,
        rightLine,
        leftLineNo: leftOffset + anchor.leftIndex,
        rightLineNo: rightOffset + anchor.rightIndex,
      });
    } else if (
      leftKey === rightKey &&
      isIgnorableLeadingFileWhitespaceDiff(
        leftLine,
        rightLine,
        options,
      )
    ) {
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
          options,
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
      options,
    ),
  );

  return result;
}

export function diffLinesFromLines(
  leftLines: string[],
  rightLines: string[],
  options: DiffLinesOptions = {},
): LineOp[] {
  const resolved = normalizeDiffLinesOptionsForLines(leftLines, rightLines, options);
  const leftCompare = buildCompareLinesWithOptions(leftLines, resolved);
  const rightCompare = buildCompareLinesWithOptions(rightLines, resolved);
  return diffLinesPatience(leftLines, rightLines, leftCompare, rightCompare, 0, 0, resolved);
}

export function diffLines(
  leftText: string,
  rightText: string,
  options: DiffLinesOptions = {},
): LineOp[] {
  const leftNormalized = normalizeText(leftText);
  const rightNormalized = normalizeText(rightText);
  const leftLines = splitLines(leftNormalized);
  const rightLines = splitLines(rightNormalized);

  return diffLinesFromLines(leftLines, rightLines, {
    ...options,
    leftLeadingFileWhitespaceEligible:
      options.leftLeadingFileWhitespaceEligible ??
      canIgnoreLeadingFileWhitespaceFromText(leftNormalized),
    rightLeadingFileWhitespaceEligible:
      options.rightLeadingFileWhitespaceEligible ??
      canIgnoreLeadingFileWhitespaceFromText(rightNormalized),
  });
}
