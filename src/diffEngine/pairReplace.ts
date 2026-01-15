import type { LineOp, PairedOp } from "./types";
import {
  buildLineFeatures,
  extractIndexTokens,
  scoreLinePair,
} from "./lineSimilarity";

function countIndent(line: string): number {
  let count = 0;
  for (const char of line) {
    if (char === " " || char === "\t") {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

type PairCandidate = {
  deleteIndex: number;
  insertIndex: number;
  indentDiff: number;
  score: number;
  distance: number;
};

const WINDOW_SIZE = 40;
const SCORE_THRESHOLD = 4;

function buildIndexMap(features: ReturnType<typeof buildLineFeatures>[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  features.forEach((feature, index) => {
    extractIndexTokens(feature).forEach((token) => {
      const bucket = map.get(token);
      if (bucket) {
        bucket.push(index);
      } else {
        map.set(token, [index]);
      }
    });
  });
  return map;
}

function buildCandidateIndices(
  index: number,
  insertCount: number,
  tokens: string[],
  indexMap: Map<string, number[]>,
): number[] {
  const indices = new Set<number>();
  const start = Math.max(0, index - WINDOW_SIZE);
  const end = Math.min(insertCount - 1, index + WINDOW_SIZE);
  for (let i = start; i <= end; i += 1) {
    indices.add(i);
  }
  tokens.forEach((token) => {
    const bucket = indexMap.get(token);
    if (!bucket) {
      return;
    }
    bucket.forEach((entry) => indices.add(entry));
  });
  return [...indices];
}

function buildCandidates(deletes: LineOp[], inserts: LineOp[]): PairCandidate[] {
  const candidates: PairCandidate[] = [];
  const deleteFeatures = deletes.map((op) => buildLineFeatures(op.leftLine ?? ""));
  const insertFeatures = inserts.map((op) => buildLineFeatures(op.rightLine ?? ""));
  const insertIndex = buildIndexMap(insertFeatures);

  for (let d = 0; d < deletes.length; d += 1) {
    const leftText = deletes[d].leftLine ?? "";
    const leftIndent = countIndent(leftText);
    const leftFeature = deleteFeatures[d];
    const tokens = extractIndexTokens(leftFeature);
    const candidateIndices = buildCandidateIndices(
      d,
      inserts.length,
      tokens,
      insertIndex,
    );

    for (const i of candidateIndices) {
      const rightText = inserts[i].rightLine ?? "";
      const rightIndent = countIndent(rightText);
      const leftTrimmed = leftText.trimStart();
      const rightTrimmed = rightText.trimStart();
      const rightFeature = insertFeatures[i];
      const distance = Math.abs(d - i);
      if (
        leftTrimmed === rightTrimmed &&
        leftTrimmed !== "" &&
        leftText !== rightText
      ) {
        candidates.push({
          deleteIndex: d,
          insertIndex: i,
          indentDiff: Math.abs(leftIndent - rightIndent),
          score: SCORE_THRESHOLD + 5,
          distance,
        });
        continue;
      }
      const scored = scoreLinePair(leftFeature, rightFeature);
      if (scored === null) {
        continue;
      }
      if (scored < SCORE_THRESHOLD) {
        continue;
      }
      candidates.push({
        deleteIndex: d,
        insertIndex: i,
        indentDiff: Math.abs(leftIndent - rightIndent),
        score: scored,
        distance,
      });
    }
  }

  return candidates;
}

function sortCandidates(a: PairCandidate, b: PairCandidate): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.indentDiff !== b.indentDiff) {
    return a.indentDiff - b.indentDiff;
  }
  if (a.distance !== b.distance) {
    return a.distance - b.distance;
  }
  if (a.deleteIndex !== b.deleteIndex) {
    return a.deleteIndex - b.deleteIndex;
  }
  return a.insertIndex - b.insertIndex;
}

function toPairedOp(op: LineOp): PairedOp {
  if (op.type === "equal") {
    return {
      type: "equal",
      leftLine: op.leftLine,
      rightLine: op.rightLine,
      leftLineNo: op.leftLineNo,
      rightLineNo: op.rightLineNo,
    };
  }

  if (op.type === "delete") {
    return {
      type: "delete",
      leftLine: op.leftLine,
      leftLineNo: op.leftLineNo,
    };
  }

  return {
    type: "insert",
    rightLine: op.rightLine,
    rightLineNo: op.rightLineNo,
  };
}

function pairBlock(deletes: LineOp[], inserts: LineOp[]): PairedOp[] {
  const usedDeletes = new Set<number>();
  const usedInserts = new Set<number>();
  const matches = new Array<number | undefined>(deletes.length).fill(undefined);
  const candidates = buildCandidates(deletes, inserts).sort(sortCandidates);

  for (const candidate of candidates) {
    if (usedDeletes.has(candidate.deleteIndex) || usedInserts.has(candidate.insertIndex)) {
      continue;
    }
    matches[candidate.deleteIndex] = candidate.insertIndex;
    usedDeletes.add(candidate.deleteIndex);
    usedInserts.add(candidate.insertIndex);
  }

  const result: PairedOp[] = [];
  const insertMatches = new Array<number | undefined>(inserts.length).fill(undefined);
  for (let i = 0; i < matches.length; i += 1) {
    const insertIndex = matches[i];
    if (insertIndex !== undefined) {
      insertMatches[insertIndex] = i;
    }
  }

  for (let i = 0; i < deletes.length; i += 1) {
    if (!usedDeletes.has(i)) {
      result.push(toPairedOp(deletes[i]));
    }
  }

  for (let i = 0; i < inserts.length; i += 1) {
    const matchedDelete = insertMatches[i];
    if (matchedDelete !== undefined) {
      const leftOp = deletes[matchedDelete];
      const rightOp = inserts[i];
      result.push({
        type: "replace",
        leftLine: leftOp.leftLine,
        rightLine: rightOp.rightLine,
        leftLineNo: leftOp.leftLineNo,
        rightLineNo: rightOp.rightLineNo,
      });
      continue;
    }
    if (!usedInserts.has(i)) {
      result.push(toPairedOp(inserts[i]));
    }
  }

  return result;
}

function isBraceLine(line: string | undefined): boolean {
  if (!line) {
    return false;
  }
  return /^}\s*;?\s*$/.test(line.trim());
}

function alignBracePairs(ops: PairedOp[]): PairedOp[] {
  const result: PairedOp[] = [];

  for (let i = 0; i < ops.length; i += 1) {
    const current = ops[i];
    const next = ops[i + 1];
    const prev = result[result.length - 1];

    const prevPaired = prev?.type === "equal" || prev?.type === "replace";

    if (
      prevPaired &&
      current?.type === "delete" &&
      next?.type === "insert" &&
      isBraceLine(current.leftLine) &&
      isBraceLine(next.rightLine) &&
      current.leftLineNo !== undefined &&
      next.rightLineNo !== undefined
    ) {
      result.push({
        type: "replace",
        leftLine: current.leftLine,
        rightLine: next.rightLine,
        leftLineNo: current.leftLineNo,
        rightLineNo: next.rightLineNo,
      });
      i += 1;
      continue;
    }

    if (
      prevPaired &&
      current?.type === "insert" &&
      next?.type === "delete" &&
      isBraceLine(next.leftLine) &&
      isBraceLine(current.rightLine) &&
      next.leftLineNo !== undefined &&
      current.rightLineNo !== undefined
    ) {
      result.push({
        type: "replace",
        leftLine: next.leftLine,
        rightLine: current.rightLine,
        leftLineNo: next.leftLineNo,
        rightLineNo: current.rightLineNo,
      });
      i += 1;
      continue;
    }

    result.push(current);
  }

  return result;
}

export function pairReplace(ops: LineOp[]): PairedOp[] {
  const result: PairedOp[] = [];
  let i = 0;

  while (i < ops.length) {
    const op = ops[i];

    if (op.type !== "delete") {
      result.push(toPairedOp(op));
      i += 1;
      continue;
    }

    const deletes: LineOp[] = [];
    while (i < ops.length && ops[i].type === "delete") {
      deletes.push(ops[i]);
      i += 1;
    }

    const inserts: LineOp[] = [];
    let j = i;
    while (j < ops.length && ops[j].type === "insert") {
      inserts.push(ops[j]);
      j += 1;
    }

    if (inserts.length === 0) {
      // No insert block follows: keep deletes as-is.
      deletes.forEach((del) => result.push(toPairedOp(del)));
      continue;
    }

    result.push(...pairBlock(deletes, inserts));
    i = j;
  }

  return alignBracePairs(result);
}
