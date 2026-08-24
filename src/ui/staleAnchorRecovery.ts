import { validateAnchors, type Anchor } from "../diffEngine/anchors";
import type { StaleManualAnchor } from "../storage/workspaces";

export type RecoverableStaleManualAnchor = StaleManualAnchor & {
  tracking?: {
    leftLineNo: number | null;
    rightLineNo: number | null;
  };
};

export type StaleAnchorRecoveryLineCounts = Readonly<{
  leftLineCount: number;
  rightLineCount: number;
}>;

export type StaleAnchorRecoveryResult = {
  manualAnchors: Anchor[];
  staleManualAnchors: RecoverableStaleManualAnchor[];
  recovered: number;
};

function cloneAnchor(anchor: Anchor): Anchor {
  return { leftLineNo: anchor.leftLineNo, rightLineNo: anchor.rightLineNo };
}

function cloneStaleAnchor(
  item: RecoverableStaleManualAnchor,
): RecoverableStaleManualAnchor {
  return {
    anchor: cloneAnchor(item.anchor),
    reason: item.reason,
    ...(item.tracking
      ? {
          tracking: {
            leftLineNo: item.tracking.leftLineNo,
            rightLineNo: item.tracking.rightLineNo,
          },
        }
      : {}),
  };
}

function isValidSet(
  anchors: readonly Anchor[],
  lineCounts: StaleAnchorRecoveryLineCounts,
): boolean {
  return (
    validateAnchors(
      [...anchors],
      lineCounts.leftLineCount,
      lineCounts.rightLineCount,
    ).invalid.length === 0
  );
}

type RecoveryCandidate = {
  index: number;
  anchor: Anchor;
};

function findInsertionIndex(
  anchors: readonly Anchor[],
  leftLineNo: number,
): number {
  let low = 0;
  let high = anchors.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (anchors[middle].leftLineNo < leftLineNo) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function isCompatibleWithActiveAnchors(
  candidate: Anchor,
  activeAnchors: readonly Anchor[],
  activeLeftLines: ReadonlySet<number>,
  activeRightLines: ReadonlySet<number>,
  lineCounts: StaleAnchorRecoveryLineCounts,
): boolean {
  if (
    candidate.leftLineNo < 0 ||
    candidate.rightLineNo < 0 ||
    candidate.leftLineNo >= lineCounts.leftLineCount ||
    candidate.rightLineNo >= lineCounts.rightLineCount ||
    activeLeftLines.has(candidate.leftLineNo) ||
    activeRightLines.has(candidate.rightLineNo)
  ) {
    return false;
  }

  const insertionIndex = findInsertionIndex(
    activeAnchors,
    candidate.leftLineNo,
  );
  const previous = activeAnchors[insertionIndex - 1];
  const next = activeAnchors[insertionIndex];
  return (
    (!previous || previous.rightLineNo < candidate.rightLineNo) &&
    (!next || candidate.rightLineNo < next.rightLineNo)
  );
}

function findConflictingCandidateIndexes(
  candidates: readonly RecoveryCandidate[],
): Set<number> {
  const sorted = [...candidates].sort(
    (left, right) =>
      left.anchor.leftLineNo - right.anchor.leftLineNo ||
      left.index - right.index,
  );
  const groups: Array<{
    start: number;
    end: number;
    minimumRightLineNo: number;
    maximumRightLineNo: number;
  }> = [];

  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    let minimumRightLineNo = sorted[start].anchor.rightLineNo;
    let maximumRightLineNo = minimumRightLineNo;
    while (
      end < sorted.length &&
      sorted[end].anchor.leftLineNo === sorted[start].anchor.leftLineNo
    ) {
      minimumRightLineNo = Math.min(
        minimumRightLineNo,
        sorted[end].anchor.rightLineNo,
      );
      maximumRightLineNo = Math.max(
        maximumRightLineNo,
        sorted[end].anchor.rightLineNo,
      );
      end += 1;
    }
    groups.push({ start, end, minimumRightLineNo, maximumRightLineNo });
    start = end;
  }

  const maximumBefore: number[] = [];
  let maximumRightLineNo = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < groups.length; index += 1) {
    maximumBefore[index] = maximumRightLineNo;
    maximumRightLineNo = Math.max(
      maximumRightLineNo,
      groups[index].maximumRightLineNo,
    );
  }

  const minimumAfter: number[] = [];
  let minimumRightLineNo = Number.POSITIVE_INFINITY;
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    minimumAfter[index] = minimumRightLineNo;
    minimumRightLineNo = Math.min(
      minimumRightLineNo,
      groups[index].minimumRightLineNo,
    );
  }

  const conflicting = new Set<number>();
  groups.forEach((group, groupIndex) => {
    const hasDuplicateLeftLine = group.end - group.start > 1;
    for (let index = group.start; index < group.end; index += 1) {
      const candidate = sorted[index];
      if (
        hasDuplicateLeftLine ||
        maximumBefore[groupIndex] >= candidate.anchor.rightLineNo ||
        minimumAfter[groupIndex] <= candidate.anchor.rightLineNo
      ) {
        conflicting.add(candidate.index);
      }
    }
  });
  return conflicting;
}

export function recoverUnambiguousStaleAnchors(
  activeAnchors: readonly Anchor[],
  staleAnchors: readonly RecoverableStaleManualAnchor[],
  lineCounts: StaleAnchorRecoveryLineCounts,
): StaleAnchorRecoveryResult {
  const active = activeAnchors.map(cloneAnchor);
  if (!isValidSet(active, lineCounts)) {
    return {
      manualAnchors: active,
      staleManualAnchors: staleAnchors.map(cloneStaleAnchor),
      recovered: 0,
    };
  }

  const sortedActive = [...active].sort(
    (left, right) => left.leftLineNo - right.leftLineNo,
  );
  const activeLeftLines = new Set(active.map((anchor) => anchor.leftLineNo));
  const activeRightLines = new Set(active.map((anchor) => anchor.rightLineNo));
  const individuallyValid: RecoveryCandidate[] = [];
  staleAnchors.forEach((item, index) => {
    const tracking = item.tracking;
    if (!tracking) {
      return;
    }
    const leftLineNo = tracking.leftLineNo;
    const rightLineNo = tracking.rightLineNo;
    if (leftLineNo === null || rightLineNo === null) {
      return;
    }
    const candidate = { leftLineNo, rightLineNo };
    if (
      isCompatibleWithActiveAnchors(
        candidate,
        sortedActive,
        activeLeftLines,
        activeRightLines,
        lineCounts,
      )
    ) {
      individuallyValid.push({ index, anchor: candidate });
    }
  });
  const conflicting = findConflictingCandidateIndexes(individuallyValid);

  const recoveryIndexes = new Set(
    individuallyValid
      .filter(({ index }) => !conflicting.has(index))
      .map(({ index }) => index),
  );
  const recoveredCandidates = individuallyValid
    .filter(({ index }) => recoveryIndexes.has(index))
    .sort((left, right) => left.index - right.index)
    .map(({ anchor }) => anchor);
  if (!isValidSet([...active, ...recoveredCandidates], lineCounts)) {
    return {
      manualAnchors: active,
      staleManualAnchors: staleAnchors.map(cloneStaleAnchor),
      recovered: 0,
    };
  }

  return {
    manualAnchors: [...active, ...recoveredCandidates].sort(
      (left, right) => left.leftLineNo - right.leftLineNo,
    ),
    staleManualAnchors: staleAnchors
      .filter((_, index) => !recoveryIndexes.has(index))
      .map(cloneStaleAnchor),
    recovered: recoveredCandidates.length,
  };
}
