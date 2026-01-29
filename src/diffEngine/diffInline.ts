import type { InlineDiff, Range } from "./types";
import { extractAppendLiteralWithMap } from "./appendLiteral";

type MatchPair = { leftIndex: number; rightIndex: number };

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

export function diffInline(leftLine: string, rightLine: string): InlineDiff {
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

type RangeMap = {
  payload: string;
  indices: number[] | null;
};

function buildRangeMap(line: string): RangeMap {
  const parsed = extractAppendLiteralWithMap(line);
  if (!parsed) {
    return { payload: line, indices: null };
  }
  return { payload: parsed.payload, indices: parsed.indices };
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
    const mappedStart = indices[range.start];
    const mappedEnd = indices[endIndex] + 1;
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

export function diffInlineWithAppendLiteral(
  leftLine: string,
  rightLine: string,
): InlineDiff {
  const leftMap = buildRangeMap(leftLine);
  const rightMap = buildRangeMap(rightLine);
  const inline = diffInline(leftMap.payload, rightMap.payload);
  return {
    leftRanges: mapRanges(inline.leftRanges, leftMap),
    rightRanges: mapRanges(inline.rightRanges, rightMap),
  };
}
