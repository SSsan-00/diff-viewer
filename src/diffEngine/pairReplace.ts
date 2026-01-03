import type { LineOp, PairedOp } from "./types";

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

function lcsLength(a: string, b: string): number {
  // Classic dynamic programming LCS to estimate line similarity.
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[a.length][b.length];
}

function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }
  return lcsLength(a, b) / maxLen;
}

type PairCandidate = {
  deleteIndex: number;
  insertIndex: number;
  indentDiff: number;
  similarity: number;
  distance: number;
};

function buildCandidates(deletes: LineOp[], inserts: LineOp[]): PairCandidate[] {
  const candidates: PairCandidate[] = [];

  for (let d = 0; d < deletes.length; d += 1) {
    const deleteOp = deletes[d];
    const leftText = deleteOp.leftLine ?? "";
    const leftIndent = countIndent(leftText);

    for (let i = 0; i < inserts.length; i += 1) {
      const insertOp = inserts[i];
      const rightText = insertOp.rightLine ?? "";
      const rightIndent = countIndent(rightText);

      candidates.push({
        deleteIndex: d,
        insertIndex: i,
        indentDiff: Math.abs(leftIndent - rightIndent),
        similarity: similarityScore(leftText, rightText),
        distance: Math.abs(d - i),
      });
    }
  }

  return candidates;
}

function sortCandidates(a: PairCandidate, b: PairCandidate): number {
  if (a.indentDiff !== b.indentDiff) {
    return a.indentDiff - b.indentDiff;
  }
  if (a.similarity !== b.similarity) {
    return b.similarity - a.similarity;
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
  for (let i = 0; i < deletes.length; i += 1) {
    const matchIndex = matches[i];
    if (matchIndex !== undefined) {
      const leftOp = deletes[i];
      const rightOp = inserts[matchIndex];
      result.push({
        type: "replace",
        leftLine: leftOp.leftLine,
        rightLine: rightOp.rightLine,
        leftLineNo: leftOp.leftLineNo,
        rightLineNo: rightOp.rightLineNo,
      });
    } else {
      result.push(toPairedOp(deletes[i]));
    }
  }

  for (let i = 0; i < inserts.length; i += 1) {
    if (!usedInserts.has(i)) {
      result.push(toPairedOp(inserts[i]));
    }
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

  return result;
}
