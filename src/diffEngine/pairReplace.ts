import type { LineOp, PairedOp } from "./types";
import { extractAppendLiteral } from "./appendLiteral";
import {
  buildLineFeatures,
  extractIndexTokens,
  scoreLinePair,
} from "./lineSimilarity";
import {
  areEquivalentTemplateIfSignatures,
  extractTemplateIfSignature,
  type TemplateIfSignature,
} from "./templateIf";

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

export type PairCandidate = {
  deleteIndex: number;
  insertIndex: number;
  indentDiff: number;
  score: number;
  distance: number;
};

type PreparedPairLine = {
  appendComparableKey: string | null;
  appendCoreComparableKey: string | null;
  commentBodyKey: string | null;
  commentFeature: ReturnType<typeof buildLineFeatures> | null;
  feature: ReturnType<typeof buildLineFeatures>;
  hasBracketedCommentPrefix: boolean;
  hasAppendLiteral: boolean;
  hasLineCommentBody: boolean;
  indent: number;
  templateIfSignature: TemplateIfSignature | null;
  text: string;
  tokens: string[];
  trimmed: string;
};

type MatchState = {
  score: number;
  pairCount: number;
  indentDiffTotal: number;
  distanceTotal: number;
  previous: MatchState | null;
  candidate: PairCandidate | null;
};

const WINDOW_SIZE = 40;
const MAX_INDEX_TOKEN_OCCURRENCES = 24;
const MAX_CANDIDATES_PER_DELETE = 160;
const SCORE_THRESHOLD = 4;
const APPEND_LITERAL_EXACT_SCORE = SCORE_THRESHOLD + 8;
const TEMPLATE_IF_EXACT_SCORE = APPEND_LITERAL_EXACT_SCORE;
const EMPTY_MATCH_STATE: MatchState = {
  score: 0,
  pairCount: 0,
  indentDiffTotal: 0,
  distanceTotal: 0,
  previous: null,
  candidate: null,
};

function normalizeAppendComparableKey(value: string): string | null {
  const normalized = value
    .replace(/[¥￥]/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function stripTrailingComparableComment(value: string): string {
  let stripped = value.trimEnd();
  const blockComment = stripped.match(/^(.*\S)\s+\/\*[\s\S]*\*\/\s*$/);
  if (blockComment?.[1]?.trim()) {
    stripped = blockComment[1].trimEnd();
  }

  const lineCommentStart = findTrailingLineCommentStart(stripped);
  if (lineCommentStart === null) {
    return stripped;
  }
  const beforeComment = stripped.slice(0, lineCommentStart).trimEnd();
  return beforeComment.trim().length > 0 ? beforeComment : stripped;
}

function findTrailingLineCommentStart(value: string): number | null {
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let index = 0; index < value.length - 1; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "/" && next === "/" && index > 0 && /\s/.test(value[index - 1])) {
      return index;
    }
  }

  return null;
}

function normalizeCommentBodyKey(value: string): string | null {
  return normalizeAppendComparableKey(value);
}

function extractLineCommentBody(line: string): {
  body: string | null;
  hasBracketedPrefix: boolean;
} {
  const bracketedPrefix = line.match(/^\s*\/{2,}\s*\[[^\]\r\n]+\]\s*:\s*(.+)$/);
  if (bracketedPrefix) {
    const body = bracketedPrefix[1]?.trim();
    return {
      body: body && body.length > 0 ? body : null,
      hasBracketedPrefix: true,
    };
  }
  const comment = line.match(/^\s*\/{2,}\s*(.+)$/);
  if (!comment) {
    return { body: null, hasBracketedPrefix: false };
  }
  const body = comment[1]?.trim();
  return {
    body: body && body.length > 0 ? body : null,
    hasBracketedPrefix: false,
  };
}

function buildAppendComparableKey(line: string): {
  key: string | null;
  coreKey: string | null;
  hasAppendLiteral: boolean;
} {
  const appendLiteral = extractAppendLiteral(line);
  const comparableText = appendLiteral ?? line;
  return {
    key: normalizeAppendComparableKey(comparableText),
    coreKey: normalizeAppendComparableKey(stripTrailingComparableComment(comparableText)),
    hasAppendLiteral: appendLiteral !== null,
  };
}

function buildCommentComparable(line: string): {
  bodyKey: string | null;
  feature: ReturnType<typeof buildLineFeatures> | null;
  hasBracketedPrefix: boolean;
  hasLineCommentBody: boolean;
} {
  const comment = extractLineCommentBody(line);
  if (!comment.body) {
    return {
      bodyKey: null,
      feature: null,
      hasBracketedPrefix: comment.hasBracketedPrefix,
      hasLineCommentBody: false,
    };
  }
  return {
    bodyKey: normalizeCommentBodyKey(comment.body),
    feature: buildLineFeatures(comment.body),
    hasBracketedPrefix: comment.hasBracketedPrefix,
    hasLineCommentBody: true,
  };
}

function addAppendPayloadToken(line: PreparedPairLine): void {
  if (line.appendComparableKey) {
    line.tokens.push(`appendpayload:${line.appendComparableKey}`);
  }
  if (line.appendCoreComparableKey) {
    line.tokens.push(`appendpayloadcore:${line.appendCoreComparableKey}`);
  }
}

function addCommentBodyTokens(line: PreparedPairLine): void {
  if (!line.hasLineCommentBody || !line.commentFeature) {
    return;
  }
  extractIndexTokens(line.commentFeature).forEach((token) => {
    line.tokens.push(`commentbody:${token}`);
  });
  if (line.commentBodyKey) {
    line.tokens.push(`commentbody:${line.commentBodyKey}`);
  }
}

function buildIndexMap(lines: PreparedPairLine[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  lines.forEach((line, index) => {
    new Set(line.tokens).forEach((token) => {
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
  const remoteCandidates = new Map<
    number,
    { bucketSize: number; distance: number; special: boolean }
  >();
  new Set(tokens).forEach((token) => {
    const bucket = indexMap.get(token);
    if (!bucket || bucket.length > MAX_INDEX_TOKEN_OCCURRENCES) {
      return;
    }
    const special =
      token.startsWith("appendpayload:") ||
      token.startsWith("appendpayloadcore:") ||
      token.startsWith("commentbody:");
    bucket.forEach((entry) => {
      if (indices.has(entry)) {
        return;
      }
      const candidate = {
        bucketSize: bucket.length,
        distance: Math.abs(index - entry),
        special,
      };
      const current = remoteCandidates.get(entry);
      if (
        !current ||
        Number(candidate.special) > Number(current.special) ||
        (candidate.special === current.special && candidate.bucketSize < current.bucketSize)
      ) {
        remoteCandidates.set(entry, candidate);
      }
    });
  });
  const sortedRemote = [...remoteCandidates.entries()].sort((a, b) => {
    if (a[1].special !== b[1].special) {
      return Number(b[1].special) - Number(a[1].special);
    }
    if (a[1].bucketSize !== b[1].bucketSize) {
      return a[1].bucketSize - b[1].bucketSize;
    }
    if (a[1].distance !== b[1].distance) {
      return a[1].distance - b[1].distance;
    }
    return a[0] - b[0];
  });
  for (const [entry] of sortedRemote) {
    if (indices.size >= MAX_CANDIDATES_PER_DELETE) {
      break;
    }
    indices.add(entry);
  }
  return [...indices];
}

function hasMatchingAppendPayload(
  left: PreparedPairLine,
  right: PreparedPairLine,
): boolean {
  return (
    (left.hasAppendLiteral || right.hasAppendLiteral) &&
    left.appendComparableKey !== null &&
    left.appendComparableKey === right.appendComparableKey
  );
}

function hasMatchingAppendCorePayload(
  left: PreparedPairLine,
  right: PreparedPairLine,
): boolean {
  return (
    (left.hasAppendLiteral || right.hasAppendLiteral) &&
    left.appendCoreComparableKey !== null &&
    left.appendCoreComparableKey === right.appendCoreComparableKey &&
    (
      left.appendCoreComparableKey !== left.appendComparableKey ||
      right.appendCoreComparableKey !== right.appendComparableKey
    )
  );
}

function canCompareCommentBodies(
  left: PreparedPairLine,
  right: PreparedPairLine,
): boolean {
  return (
    left.hasLineCommentBody &&
    right.hasLineCommentBody &&
    (left.hasBracketedCommentPrefix || right.hasBracketedCommentPrefix)
  );
}

export function buildPairCandidates(
  deletes: LineOp[],
  inserts: LineOp[],
): PairCandidate[] {
  const candidates: PairCandidate[] = [];
  const deletePrepared: PreparedPairLine[] = deletes.map((op) => {
    const text = op.leftLine ?? "";
    const feature = buildLineFeatures(text);
    const appendComparable = buildAppendComparableKey(text);
    const commentComparable = buildCommentComparable(text);
    const tokens = extractIndexTokens(feature);
    return {
      appendComparableKey: appendComparable.key,
      appendCoreComparableKey: appendComparable.coreKey,
      commentBodyKey: commentComparable.bodyKey,
      commentFeature: commentComparable.feature,
      feature,
      hasBracketedCommentPrefix: commentComparable.hasBracketedPrefix,
      hasAppendLiteral: appendComparable.hasAppendLiteral,
      hasLineCommentBody: commentComparable.hasLineCommentBody,
      indent: countIndent(text),
      templateIfSignature: extractTemplateIfSignature(text),
      text,
      tokens,
      trimmed: text.trimStart(),
    };
  });
  const insertPrepared: PreparedPairLine[] = inserts.map((op) => {
    const text = op.rightLine ?? "";
    const feature = buildLineFeatures(text);
    const appendComparable = buildAppendComparableKey(text);
    const commentComparable = buildCommentComparable(text);
    const tokens = extractIndexTokens(feature);
    return {
      appendComparableKey: appendComparable.key,
      appendCoreComparableKey: appendComparable.coreKey,
      commentBodyKey: commentComparable.bodyKey,
      commentFeature: commentComparable.feature,
      feature,
      hasBracketedCommentPrefix: commentComparable.hasBracketedPrefix,
      hasAppendLiteral: appendComparable.hasAppendLiteral,
      hasLineCommentBody: commentComparable.hasLineCommentBody,
      indent: countIndent(text),
      templateIfSignature: extractTemplateIfSignature(text),
      text,
      tokens,
      trimmed: text.trimStart(),
    };
  });
  const hasAppendLiteralInBlock =
    deletePrepared.some((entry) => entry.hasAppendLiteral) ||
    insertPrepared.some((entry) => entry.hasAppendLiteral);
  if (hasAppendLiteralInBlock) {
    deletePrepared.forEach(addAppendPayloadToken);
    insertPrepared.forEach(addAppendPayloadToken);
  }
  const hasBracketedCommentPrefixInBlock =
    deletePrepared.some((entry) => entry.hasBracketedCommentPrefix) ||
    insertPrepared.some((entry) => entry.hasBracketedCommentPrefix);
  if (hasBracketedCommentPrefixInBlock) {
    deletePrepared.forEach(addCommentBodyTokens);
    insertPrepared.forEach(addCommentBodyTokens);
  }
  const insertIndex = buildIndexMap(insertPrepared);

  for (let d = 0; d < deletes.length; d += 1) {
    const left = deletePrepared[d];
    const candidateIndices = buildCandidateIndices(
      d,
      inserts.length,
      left.tokens,
      insertIndex,
    );

    for (const i of candidateIndices) {
      const right = insertPrepared[i];
      const distance = Math.abs(d - i);
      if (
        left.text !== right.text &&
        hasMatchingAppendPayload(left, right)
      ) {
        candidates.push({
          deleteIndex: d,
          insertIndex: i,
          indentDiff: Math.abs(left.indent - right.indent),
          score: APPEND_LITERAL_EXACT_SCORE,
          distance,
        });
        continue;
      }
      if (
        left.text !== right.text &&
        hasMatchingAppendCorePayload(left, right)
      ) {
        candidates.push({
          deleteIndex: d,
          insertIndex: i,
          indentDiff: Math.abs(left.indent - right.indent),
          score: APPEND_LITERAL_EXACT_SCORE - 1,
          distance,
        });
        continue;
      }
      if (
        left.text !== right.text &&
        canCompareCommentBodies(left, right) &&
        left.commentBodyKey !== null &&
        left.commentBodyKey === right.commentBodyKey
      ) {
        candidates.push({
          deleteIndex: d,
          insertIndex: i,
          indentDiff: Math.abs(left.indent - right.indent),
          score: APPEND_LITERAL_EXACT_SCORE,
          distance,
        });
        continue;
      }
      if (
        left.text !== right.text &&
        canCompareCommentBodies(left, right) &&
        left.commentFeature &&
        right.commentFeature
      ) {
        const commentScore = scoreLinePair(left.commentFeature, right.commentFeature);
        if (commentScore !== null && commentScore >= SCORE_THRESHOLD) {
          candidates.push({
            deleteIndex: d,
            insertIndex: i,
            indentDiff: Math.abs(left.indent - right.indent),
            score: commentScore,
            distance,
          });
          continue;
        }
      }
      if (
        areEquivalentTemplateIfSignatures(
          left.templateIfSignature,
          right.templateIfSignature,
        )
      ) {
        candidates.push({
          deleteIndex: d,
          insertIndex: i,
          indentDiff: Math.abs(left.indent - right.indent),
          score: TEMPLATE_IF_EXACT_SCORE,
          distance,
        });
        continue;
      }
      if (
        left.trimmed === right.trimmed &&
        left.trimmed !== "" &&
        left.text !== right.text
      ) {
        candidates.push({
          deleteIndex: d,
          insertIndex: i,
          indentDiff: Math.abs(left.indent - right.indent),
          score: SCORE_THRESHOLD + 5,
          distance,
        });
        continue;
      }
      const scored = scoreLinePair(left.feature, right.feature);
      if (scored === null) {
        continue;
      }
      if (scored < SCORE_THRESHOLD) {
        continue;
      }
      candidates.push({
        deleteIndex: d,
        insertIndex: i,
        indentDiff: Math.abs(left.indent - right.indent),
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

function compareMatchStates(a: MatchState | null, b: MatchState | null): number {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.pairCount !== b.pairCount) {
    return b.pairCount - a.pairCount;
  }
  if (a.indentDiffTotal !== b.indentDiffTotal) {
    return a.indentDiffTotal - b.indentDiffTotal;
  }
  if (a.distanceTotal !== b.distanceTotal) {
    return a.distanceTotal - b.distanceTotal;
  }
  const aCandidate = a.candidate;
  const bCandidate = b.candidate;
  if (!aCandidate && !bCandidate) {
    return 0;
  }
  if (!aCandidate) {
    return 1;
  }
  if (!bCandidate) {
    return -1;
  }
  return sortCandidates(aCandidate, bCandidate);
}

function pickBetterMatchState(
  current: MatchState | null,
  candidate: MatchState | null,
): MatchState | null {
  return compareMatchStates(current, candidate) <= 0 ? current : candidate;
}

function buildMatchState(
  previous: MatchState,
  candidate: PairCandidate,
): MatchState {
  return {
    score: previous.score + candidate.score,
    pairCount: previous.pairCount + 1,
    indentDiffTotal: previous.indentDiffTotal + candidate.indentDiff,
    distanceTotal: previous.distanceTotal + candidate.distance,
    previous,
    candidate,
  };
}

function collectMatchPairs(state: MatchState | null): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  let current = state;
  while (current?.candidate) {
    pairs.push([current.candidate.deleteIndex, current.candidate.insertIndex]);
    current = current.previous;
  }
  return pairs.reverse();
}

function createFenwickBest(size: number): {
  query: (upTo: number) => MatchState;
  update: (index: number, state: MatchState) => void;
} {
  const tree = new Array<MatchState | null>(size + 1).fill(null);

  return {
    query(upTo: number): MatchState {
      let best: MatchState | null = EMPTY_MATCH_STATE;
      let index = upTo;
      while (index > 0) {
        best = pickBetterMatchState(best, tree[index]);
        index -= index & -index;
      }
      return best ?? EMPTY_MATCH_STATE;
    },
    update(index: number, state: MatchState): void {
      let currentIndex = index;
      while (currentIndex < tree.length) {
        tree[currentIndex] = pickBetterMatchState(tree[currentIndex], state);
        currentIndex += currentIndex & -currentIndex;
      }
    },
  };
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
  const emittedInserts = new Set<number>();
  const matches = new Array<number | undefined>(deletes.length).fill(undefined);
  const candidatesByDelete = Array.from(
    { length: deletes.length },
    () => [] as PairCandidate[],
  );

  for (const candidate of buildPairCandidates(deletes, inserts)) {
    candidatesByDelete[candidate.deleteIndex].push(candidate);
  }

  candidatesByDelete.forEach((bucket) =>
    bucket.sort((a, b) =>
      a.insertIndex === b.insertIndex ? sortCandidates(a, b) : a.insertIndex - b.insertIndex,
    ),
  );

  const fenwick = createFenwickBest(inserts.length);
  let bestState: MatchState = EMPTY_MATCH_STATE;

  for (let deleteIndex = 0; deleteIndex < deletes.length; deleteIndex += 1) {
    const updates = candidatesByDelete[deleteIndex].map((candidate) => ({
      insertIndex: candidate.insertIndex,
      state: buildMatchState(fenwick.query(candidate.insertIndex), candidate),
    }));

    for (const update of updates) {
      fenwick.update(update.insertIndex + 1, update.state);
      if (compareMatchStates(bestState, update.state) > 0) {
        bestState = update.state;
      }
    }
  }

  collectMatchPairs(bestState).forEach(([deleteIndex, insertIndex]) => {
    matches[deleteIndex] = insertIndex;
  });

  const matchedInsertIndices = new Set<number>();
  matches.forEach((value) => {
    if (value !== undefined) {
      matchedInsertIndices.add(value);
    }
  });

  const result: PairedOp[] = [];
  let insertCursor = 0;

  const emitUnmatchedInsertsBefore = (stopRightLineNo?: number) => {
    while (insertCursor < inserts.length) {
      const insert = inserts[insertCursor];
      const insertLineNo = insert.rightLineNo ?? Number.MAX_SAFE_INTEGER;
      if (stopRightLineNo !== undefined && insertLineNo >= stopRightLineNo) {
        break;
      }
      if (!matchedInsertIndices.has(insertCursor) && !emittedInserts.has(insertCursor)) {
        result.push(toPairedOp(insert));
        emittedInserts.add(insertCursor);
      }
      insertCursor += 1;
    }
  };

  for (let i = 0; i < deletes.length; i += 1) {
    const insertIndex = matches[i];
    if (insertIndex !== undefined) {
      const leftOp = deletes[i];
      const rightOp = inserts[insertIndex];
      emitUnmatchedInsertsBefore(rightOp.rightLineNo);
      result.push({
        type: "replace",
        leftLine: leftOp.leftLine,
        rightLine: rightOp.rightLine,
        leftLineNo: leftOp.leftLineNo,
        rightLineNo: rightOp.rightLineNo,
      });
      while (insertCursor <= insertIndex && insertCursor < inserts.length) {
        insertCursor += 1;
      }
      continue;
    }
    result.push(toPairedOp(deletes[i]));
  }

  emitUnmatchedInsertsBefore(undefined);
  for (let i = 0; i < inserts.length; i += 1) {
    if (!matchedInsertIndices.has(i) && !emittedInserts.has(i)) {
      result.push(toPairedOp(inserts[i]));
      emittedInserts.add(i);
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
