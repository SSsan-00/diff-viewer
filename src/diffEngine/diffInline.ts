import type { InlineDiff, Range } from "./types";
import { extractAppendLiteralInlineMap } from "./appendLiteral";

type MatchPair = { leftIndex: number; rightIndex: number };
export type DiffInlineCore = (leftLine: string, rightLine: string) => InlineDiff;
export type DiffInlineBatchInput = {
  leftLine: string;
  rightLine: string;
};
export type DiffInlineBatchCore = (inputs: DiffInlineBatchInput[]) => InlineDiff[];
export type DiffInlineWithAppendLiteralBatchInput = DiffInlineBatchInput & {
  options?: DiffInlineWithAppendLiteralOptions;
};

function buildLcsTable(left: string, right: string): number[][] {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

function backtrackMatches(
  left: string,
  right: string,
  table: number[][],
): MatchPair[] {
  const matches: MatchPair[] = [];
  let i = left.length;
  let j = right.length;

  // Walk backwards to collect one LCS alignment as matched positions.
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      matches.push({ leftIndex: i - 1, rightIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return matches.reverse();
}

function buildMatchedFlags(length: number, matches: MatchPair[], side: "left" | "right"): boolean[] {
  const flags = new Array<boolean>(length).fill(false);
  for (const match of matches) {
    const index = side === "left" ? match.leftIndex : match.rightIndex;
    flags[index] = true;
  }
  return flags;
}

function buildRangesFromFlags(flags: boolean[]): Range[] {
  const ranges: Range[] = [];
  let start: number | null = null;

  for (let i = 0; i < flags.length; i += 1) {
    if (!flags[i]) {
      if (start === null) {
        start = i;
      }
    } else if (start !== null) {
      ranges.push({ start, end: i });
      start = null;
    }
  }

  if (start !== null) {
    ranges.push({ start, end: flags.length });
  }

  return ranges;
}

function mergeRanges(ranges: Range[], maxGap: number): Range[] {
  if (ranges.length === 0) {
    return [];
  }

  const merged: Range[] = [];
  let current = { ...ranges[0] };

  for (let i = 1; i < ranges.length; i += 1) {
    const next = ranges[i];
    const gap = next.start - current.end;

    if (gap <= maxGap) {
      current.end = next.end;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

function diffInlineTypeScript(leftLine: string, rightLine: string): InlineDiff {
  if (leftLine === rightLine) {
    return { leftRanges: [], rightRanges: [] };
  }

  const table = buildLcsTable(leftLine, rightLine);
  const matches = backtrackMatches(leftLine, rightLine, table);
  const leftFlags = buildMatchedFlags(leftLine.length, matches, "left");
  const rightFlags = buildMatchedFlags(rightLine.length, matches, "right");

  const leftRanges = mergeRanges(buildRangesFromFlags(leftFlags), 1);
  const rightRanges = mergeRanges(buildRangesFromFlags(rightFlags), 1);

  return { leftRanges, rightRanges };
}

let activeDiffInlineCore: DiffInlineCore = diffInlineTypeScript;
let activeDiffInlineBatchCore: DiffInlineBatchCore = (inputs) =>
  inputs.map((input) => activeDiffInlineCore(input.leftLine, input.rightLine));

export function createDiffInline(
  diffCore: DiffInlineCore = diffInlineTypeScript,
): DiffInlineCore {
  return (leftLine, rightLine) => diffCore(leftLine, rightLine);
}

export function createDiffInlineBatch(
  diffBatchCore: DiffInlineBatchCore = activeDiffInlineBatchCore,
): DiffInlineBatchCore {
  return (inputs) => diffBatchCore(inputs);
}

export function setDiffInlineCore(diffCore: DiffInlineCore | null): void {
  activeDiffInlineCore = diffCore ?? diffInlineTypeScript;
}

export function setDiffInlineBatchCore(diffBatchCore: DiffInlineBatchCore | null): void {
  activeDiffInlineBatchCore = diffBatchCore ?? ((inputs) =>
    inputs.map((input) => activeDiffInlineCore(input.leftLine, input.rightLine)));
}

export function diffInline(leftLine: string, rightLine: string): InlineDiff {
  return activeDiffInlineCore(leftLine, rightLine);
}

export function diffInlineBatch(inputs: DiffInlineBatchInput[]): InlineDiff[] {
  if (inputs.length === 0) {
    return [];
  }
  const results = activeDiffInlineBatchCore(inputs);
  if (results.length !== inputs.length) {
    throw new Error("Inline diff batch core returned an unexpected result count.");
  }
  return results;
}

type RangeMap = {
  compareText: string;
  indices: number[] | null;
  wrapperRanges: Range[];
  payloadRange: Range | null;
};

type PreparedDiffInlineWithAppendLiteral = {
  leftLine: string;
  leftCompare: string;
  leftMap: RangeMap;
  leftOriginalPrefixOffset: number;
  leftPrefixOffset: number;
  rightLine: string;
  rightCompare: string;
  rightMap: RangeMap;
  rightOriginalPrefixOffset: number;
  rightPrefixOffset: number;
};

function buildRangeMap(line: string): RangeMap {
  const parsed = extractAppendLiteralInlineMap(line);
  if (!parsed) {
    return { compareText: line, indices: null, wrapperRanges: [], payloadRange: null };
  }
  return {
    compareText: parsed.payload,
    indices: parsed.indices,
    wrapperRanges: parsed.wrapperRanges,
    payloadRange: parsed.payloadRange,
  };
}

function prepareDiffInlineWithAppendLiteral(
  leftLine: string,
  rightLine: string,
  options: DiffInlineWithAppendLiteralOptions,
): PreparedDiffInlineWithAppendLiteral {
  const leftMap = buildRangeMap(leftLine);
  const rightMap = buildRangeMap(rightLine);
  let leftCompare = leftMap.compareText;
  let rightCompare = rightMap.compareText;
  let leftPrefixOffset = 0;
  let rightPrefixOffset = 0;
  let leftOriginalPrefixOffset = 0;
  let rightOriginalPrefixOffset = 0;

  if (shouldIgnoreLeadingFileWhitespaceInInlineDiff(options)) {
    leftPrefixOffset = countLeadingSpacesAndTabs(leftCompare);
    rightPrefixOffset = countLeadingSpacesAndTabs(rightCompare);
    leftOriginalPrefixOffset = countLeadingSpacesAndTabs(leftLine);
    rightOriginalPrefixOffset = countLeadingSpacesAndTabs(rightLine);
    if (leftPrefixOffset > 0 || rightPrefixOffset > 0) {
      leftCompare = leftCompare.slice(leftPrefixOffset);
      rightCompare = rightCompare.slice(rightPrefixOffset);
    }
  }

  return {
    leftLine,
    leftCompare,
    leftMap,
    leftOriginalPrefixOffset,
    leftPrefixOffset,
    rightLine,
    rightCompare,
    rightMap,
    rightOriginalPrefixOffset,
    rightPrefixOffset,
  };
}

function mapInlineDiffWithAppendLiteral(
  inline: InlineDiff,
  prepared: PreparedDiffInlineWithAppendLiteral,
): InlineDiff {
  const leftWrapperRanges = resolveWrapperRanges(
    prepared.leftLine,
    prepared.leftMap,
    prepared.rightLine,
    prepared.rightMap,
  );
  const rightWrapperRanges = resolveWrapperRanges(
    prepared.rightLine,
    prepared.rightMap,
    prepared.leftLine,
    prepared.leftMap,
  );
  const leftMapped = combineRanges(
    mapRanges(offsetRanges(inline.leftRanges, prepared.leftPrefixOffset), prepared.leftMap),
    leftWrapperRanges,
  );
  const rightMapped = combineRanges(
    mapRanges(offsetRanges(inline.rightRanges, prepared.rightPrefixOffset), prepared.rightMap),
    rightWrapperRanges,
  );
  return {
    leftRanges: trimRangesBefore(leftMapped, prepared.leftOriginalPrefixOffset),
    rightRanges: trimRangesBefore(rightMapped, prepared.rightOriginalPrefixOffset),
  };
}

function resolveWrapperRanges(
  currentLine: string,
  currentMap: RangeMap,
  otherLine: string,
  otherMap: RangeMap,
): Range[] {
  if (currentMap.wrapperRanges.length === 0) {
    return [];
  }
  if (otherMap.wrapperRanges.length === 0) {
    return currentMap.wrapperRanges;
  }
  if (extractWrapperText(currentLine, currentMap) !== extractWrapperText(otherLine, otherMap)) {
    return currentMap.wrapperRanges;
  }
  return [];
}

function extractWrapperText(line: string, map: RangeMap): string {
  if (!map.payloadRange) {
    return line;
  }
  return line.slice(0, map.payloadRange.start) + line.slice(map.payloadRange.end);
}

function mapRanges(ranges: Range[], map: RangeMap): Range[] {
  if (!map.indices) {
    return ranges;
  }
  if (ranges.length === 0) {
    return [];
  }
  const mapped: Range[] = [];
  const indices = map.indices;
  for (const range of ranges) {
    if (range.start >= indices.length) {
      continue;
    }
    const endIndex = Math.max(range.start, range.end - 1);
    if (endIndex >= indices.length) {
      continue;
    }
    let mappedStart = indices[range.start];
    let mappedEnd = indices[endIndex] + 1;
    if (map.payloadRange) {
      const payloadStart = map.payloadRange.start;
      const payloadEnd = map.payloadRange.end;
      if (mappedEnd <= payloadStart || mappedStart >= payloadEnd) {
        continue;
      }
      mappedStart = Math.max(mappedStart, payloadStart);
      mappedEnd = Math.min(mappedEnd, payloadEnd);
    }
    if (mappedEnd <= mappedStart) {
      continue;
    }
    const last = mapped[mapped.length - 1];
    if (last && last.end === mappedStart) {
      last.end = mappedEnd;
      continue;
    }
    mapped.push({ start: mappedStart, end: mappedEnd });
  }
  return mapped;
}

function combineRanges(base: Range[], extra: Range[]): Range[] {
  if (extra.length === 0) {
    return base;
  }
  if (base.length === 0) {
    return [...extra];
  }
  const combined = [...base, ...extra].sort((a, b) =>
    a.start === b.start ? a.end - b.end : a.start - b.start,
  );
  const merged: Range[] = [];
  for (const range of combined) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) {
      last.end = Math.max(last.end, range.end);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function countLeadingSpacesAndTabs(value: string): number {
  let index = 0;
  while (index < value.length) {
    const ch = value[index];
    if (ch !== " " && ch !== "\t") {
      break;
    }
    index += 1;
  }
  return index;
}

function offsetRanges(ranges: Range[], offset: number): Range[] {
  if (offset === 0 || ranges.length === 0) {
    return ranges;
  }
  return ranges.map((range) => ({ start: range.start + offset, end: range.end + offset }));
}

function trimRangesBefore(ranges: Range[], cutoff: number): Range[] {
  if (cutoff <= 0 || ranges.length === 0) {
    return ranges;
  }
  const trimmed: Range[] = [];
  for (const range of ranges) {
    if (range.end <= cutoff) {
      continue;
    }
    if (range.start < cutoff) {
      trimmed.push({ start: cutoff, end: range.end });
      continue;
    }
    trimmed.push(range);
  }
  return trimmed;
}

export type DiffInlineWithAppendLiteralOptions = {
  ignoreLeadingFileWhitespace?: boolean;
  leftLineNo?: number;
  rightLineNo?: number;
  leftLeadingFileWhitespaceEligible?: boolean;
  rightLeadingFileWhitespaceEligible?: boolean;
};

function shouldIgnoreLeadingFileWhitespaceInInlineDiff(
  options: DiffInlineWithAppendLiteralOptions,
): boolean {
  if (options.ignoreLeadingFileWhitespace !== true) {
    return false;
  }
  if (options.leftLeadingFileWhitespaceEligible === false) {
    return false;
  }
  if (options.rightLeadingFileWhitespaceEligible === false) {
    return false;
  }
  return true;
}

export function diffInlineWithAppendLiteral(
  leftLine: string,
  rightLine: string,
  options: DiffInlineWithAppendLiteralOptions = {},
): InlineDiff {
  const prepared = prepareDiffInlineWithAppendLiteral(leftLine, rightLine, options);
  const inline = diffInline(prepared.leftCompare, prepared.rightCompare);
  return mapInlineDiffWithAppendLiteral(inline, prepared);
}

export function diffInlineWithAppendLiteralBatch(
  inputs: readonly DiffInlineWithAppendLiteralBatchInput[],
): InlineDiff[] {
  if (inputs.length === 0) {
    return [];
  }
  const prepared = inputs.map((input) =>
    prepareDiffInlineWithAppendLiteral(
      input.leftLine,
      input.rightLine,
      input.options ?? {},
    ),
  );
  const inlineResults = diffInlineBatch(
    prepared.map((entry) => ({
      leftLine: entry.leftCompare,
      rightLine: entry.rightCompare,
    })),
  );
  return inlineResults.map((inline, index) =>
    mapInlineDiffWithAppendLiteral(inline, prepared[index]),
  );
}
