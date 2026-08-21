import type { InlineDiff, Range } from "./types";
import { extractAppendLiteralInlineMap } from "./appendLiteral";

type MatchPair = { leftIndex: number; rightIndex: number };
const MAX_INLINE_LCS_CELLS = 1_000_000;
const graphemeSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;
const combiningMarkPattern = /\p{Mark}/u;
let cachedGraphemeValue: string | null = null;
let cachedGraphemeBoundaries: number[] = [0];
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

function codePointWidth(value: string, index: number): number {
  const codePoint = value.codePointAt(index);
  return codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
}

function isFallbackGraphemeExtension(codePoint: number): boolean {
  return combiningMarkPattern.test(String.fromCodePoint(codePoint)) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef) ||
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
    codePoint === 0x20e3;
}

function buildFallbackGraphemeBoundaries(value: string): number[] {
  const boundaries = [0];
  let index = 0;
  while (index < value.length) {
    const firstCodePoint = value.codePointAt(index);
    index += codePointWidth(value, index);

    if (
      firstCodePoint !== undefined &&
      firstCodePoint >= 0x1f1e6 &&
      firstCodePoint <= 0x1f1ff &&
      index < value.length
    ) {
      const nextCodePoint = value.codePointAt(index);
      if (
        nextCodePoint !== undefined &&
        nextCodePoint >= 0x1f1e6 &&
        nextCodePoint <= 0x1f1ff
      ) {
        index += codePointWidth(value, index);
      }
    }

    while (index < value.length) {
      const codePoint = value.codePointAt(index);
      if (codePoint === undefined) {
        break;
      }
      if (isFallbackGraphemeExtension(codePoint)) {
        index += codePointWidth(value, index);
        continue;
      }
      if (codePoint === 0x200d && index + 1 < value.length) {
        index += 1;
        index += codePointWidth(value, index);
        continue;
      }
      break;
    }
    boundaries.push(index);
  }
  return boundaries;
}

function buildGraphemeBoundaries(value: string): number[] {
  if (cachedGraphemeValue === value) {
    return cachedGraphemeBoundaries;
  }
  let boundaries: number[];
  if (!graphemeSegmenter || value.length === 0) {
    boundaries = value.length === 0 ? [0] : buildFallbackGraphemeBoundaries(value);
  } else {
    boundaries = [0];
    for (const segment of graphemeSegmenter.segment(value)) {
      if (segment.index > boundaries[boundaries.length - 1]) {
        boundaries.push(segment.index);
      }
    }
    if (boundaries[boundaries.length - 1] !== value.length) {
      boundaries.push(value.length);
    }
  }
  cachedGraphemeValue = value;
  cachedGraphemeBoundaries = boundaries;
  return boundaries;
}

function findBoundaryAtOrBefore(boundaries: number[], value: number): number {
  let low = 0;
  let high = boundaries.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (boundaries[middle] <= value) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return boundaries[low];
}

function findBoundaryAtOrAfter(boundaries: number[], value: number): number {
  let low = 0;
  let high = boundaries.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (boundaries[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return boundaries[low];
}

export function snapInlineRangesToGraphemeBoundaries(
  value: string,
  ranges: readonly Range[],
): Range[] {
  if (ranges.length === 0 || value.length === 0) {
    return [];
  }
  const boundaries = buildGraphemeBoundaries(value);
  const snapped: Range[] = [];
  for (const range of ranges) {
    const rawStart = Math.max(0, Math.min(value.length, range.start));
    const rawEnd = Math.max(rawStart, Math.min(value.length, range.end));
    if (rawEnd <= rawStart) {
      continue;
    }
    const start = findBoundaryAtOrBefore(boundaries, rawStart);
    const end = findBoundaryAtOrAfter(boundaries, rawEnd);
    if (end <= start) {
      continue;
    }
    const last = snapped[snapped.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      snapped.push({ start, end });
    }
  }
  return snapped;
}

function snapInlineDiffToGraphemeBoundaries(
  leftLine: string,
  rightLine: string,
  inline: InlineDiff,
): InlineDiff {
  return {
    leftRanges: snapInlineRangesToGraphemeBoundaries(leftLine, inline.leftRanges),
    rightRanges: snapInlineRangesToGraphemeBoundaries(rightLine, inline.rightRanges),
  };
}

function findCommonEdges(left: string, right: string): {
  leftEnd: number;
  prefix: number;
  rightEnd: number;
} {
  const maxPrefix = Math.min(left.length, right.length);
  let prefix = 0;
  while (prefix < maxPrefix && left[prefix] === right[prefix]) {
    prefix += 1;
  }

  let leftEnd = left.length;
  let rightEnd = right.length;
  while (
    leftEnd > prefix &&
    rightEnd > prefix &&
    left[leftEnd - 1] === right[rightEnd - 1]
  ) {
    leftEnd -= 1;
    rightEnd -= 1;
  }
  return { leftEnd, prefix, rightEnd };
}

function exceedsLcsCellBudget(leftLength: number, rightLength: number): boolean {
  return leftLength > 0 &&
    rightLength > 0 &&
    leftLength > Math.floor(MAX_INLINE_LCS_CELLS / rightLength);
}

function diffInlineTypeScript(leftLine: string, rightLine: string): InlineDiff {
  if (leftLine === rightLine) {
    return { leftRanges: [], rightRanges: [] };
  }

  const { leftEnd, prefix, rightEnd } = findCommonEdges(leftLine, rightLine);
  const leftMiddle = leftLine.slice(prefix, leftEnd);
  const rightMiddle = rightLine.slice(prefix, rightEnd);
  if (leftMiddle.length === 0 || rightMiddle.length === 0) {
    return {
      leftRanges: leftMiddle.length > 0 ? [{ start: prefix, end: leftEnd }] : [],
      rightRanges: rightMiddle.length > 0 ? [{ start: prefix, end: rightEnd }] : [],
    };
  }
  if (exceedsLcsCellBudget(leftMiddle.length, rightMiddle.length)) {
    return {
      leftRanges: leftMiddle.length > 0 ? [{ start: prefix, end: leftEnd }] : [],
      rightRanges: rightMiddle.length > 0 ? [{ start: prefix, end: rightEnd }] : [],
    };
  }

  const table = buildLcsTable(leftMiddle, rightMiddle);
  const matches = backtrackMatches(leftMiddle, rightMiddle, table);
  const leftFlags = buildMatchedFlags(leftMiddle.length, matches, "left");
  const rightFlags = buildMatchedFlags(rightMiddle.length, matches, "right");

  const leftRanges = offsetRanges(
    mergeRanges(buildRangesFromFlags(leftFlags), 1),
    prefix,
  );
  const rightRanges = offsetRanges(
    mergeRanges(buildRangesFromFlags(rightFlags), 1),
    prefix,
  );

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
  if (leftLine === rightLine) {
    return { leftRanges: [], rightRanges: [] };
  }
  return snapInlineDiffToGraphemeBoundaries(
    leftLine,
    rightLine,
    activeDiffInlineCore(leftLine, rightLine),
  );
}

export function diffInlineBatch(inputs: DiffInlineBatchInput[]): InlineDiff[] {
  if (inputs.length === 0) {
    return [];
  }
  const changedInputs: DiffInlineBatchInput[] = [];
  const changedIndexes: number[] = [];
  const results: InlineDiff[] = inputs.map((input, index) => {
    if (input.leftLine === input.rightLine) {
      return { leftRanges: [], rightRanges: [] };
    }
    changedInputs.push(input);
    changedIndexes.push(index);
    return { leftRanges: [], rightRanges: [] };
  });
  if (changedInputs.length === 0) {
    return results;
  }
  const changedResults = activeDiffInlineBatchCore(changedInputs);
  if (changedResults.length !== changedInputs.length) {
    throw new Error("Inline diff batch core returned an unexpected result count.");
  }
  changedResults.forEach((inline, changedIndex) => {
    const resultIndex = changedIndexes[changedIndex];
    const input = inputs[resultIndex];
    results[resultIndex] = snapInlineDiffToGraphemeBoundaries(
      input.leftLine,
      input.rightLine,
      inline,
    );
  });
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
  return snapInlineDiffToGraphemeBoundaries(
    leftLine,
    rightLine,
    mapInlineDiffWithAppendLiteral(inline, prepared),
  );
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
  return inlineResults.map((inline, index) => {
    const entry = prepared[index];
    return snapInlineDiffToGraphemeBoundaries(
      entry.leftLine,
      entry.rightLine,
      mapInlineDiffWithAppendLiteral(inline, entry),
    );
  });
}
