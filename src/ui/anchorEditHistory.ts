export type VersionedStateChange = {
  versionId: number | null;
  isUndoing: boolean;
  isRedoing: boolean;
};

export type VersionedStateTransition<State> = {
  from: State;
  to: State;
};

type StoredVersionedStateTransition<State> = {
  fromVersionId: number;
  toVersionId: number;
  from: State;
  to: State;
};

type PendingVersionedStateTransition<State> = {
  fromVersionId: number;
  toVersionId: number;
  from: State;
};

export const DEFAULT_VERSIONED_STATE_HISTORY_LIMIT = 500;

export type VersionedStateHistory<State> = {
  currentVersionId: number | null;
  snapshots: Map<number, State>;
  clone: (state: State) => State;
  versionOrder: number[];
  currentVersionIndex: number;
  transitions: StoredVersionedStateTransition<State>[];
  pendingTransition: PendingVersionedStateTransition<State> | null;
  maxSnapshots: number;
};

export type VersionedStateHistoryOptions = {
  maxSnapshots?: number;
};

function normalizeHistoryLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VERSIONED_STATE_HISTORY_LIMIT;
  }
  return Math.max(2, Math.floor(value ?? DEFAULT_VERSIONED_STATE_HISTORY_LIMIT));
}

function removeTransitionForVersion<State>(
  history: VersionedStateHistory<State>,
  versionId: number,
): void {
  history.transitions = history.transitions.filter(
    (transition) =>
      transition.fromVersionId !== versionId &&
      transition.toVersionId !== versionId,
  );
}

function pruneVersionedStateHistory<State>(
  history: VersionedStateHistory<State>,
): void {
  while (history.versionOrder.length > history.maxSnapshots) {
    const removedVersionId = history.versionOrder.shift();
    if (removedVersionId === undefined) {
      break;
    }
    history.snapshots.delete(removedVersionId);
    removeTransitionForVersion(history, removedVersionId);
    history.currentVersionIndex -= 1;
  }
  if (history.currentVersionIndex < 0 && history.versionOrder.length > 0) {
    history.currentVersionIndex = 0;
  }
}

function truncateRedoBranch<State>(
  history: VersionedStateHistory<State>,
): void {
  if (history.currentVersionIndex < 0) {
    history.snapshots.clear();
    history.transitions = [];
    history.versionOrder = [];
    return;
  }
  const obsoleteVersionIds = history.versionOrder.splice(
    history.currentVersionIndex + 1,
  );
  obsoleteVersionIds.forEach((versionId) => {
    history.snapshots.delete(versionId);
    removeTransitionForVersion(history, versionId);
  });
}

function appendVersion<State>(
  history: VersionedStateHistory<State>,
  versionId: number,
): void {
  const duplicateIndex = history.versionOrder.indexOf(versionId);
  if (duplicateIndex >= 0) {
    history.versionOrder.splice(duplicateIndex, 1);
    history.snapshots.delete(versionId);
    removeTransitionForVersion(history, versionId);
    if (duplicateIndex <= history.currentVersionIndex) {
      history.currentVersionIndex -= 1;
    }
  }
  history.versionOrder.push(versionId);
  history.currentVersionIndex = history.versionOrder.length - 1;
}

function findStoredTransition<State>(
  history: VersionedStateHistory<State>,
  fromVersionId: number,
  toVersionId: number,
): VersionedStateTransition<State> | null {
  const stored = history.transitions.find(
    (transition) =>
      (transition.fromVersionId === fromVersionId &&
        transition.toVersionId === toVersionId) ||
      (transition.fromVersionId === toVersionId &&
        transition.toVersionId === fromVersionId),
  );
  if (!stored) {
    return null;
  }
  const forward = stored.fromVersionId === fromVersionId;
  return {
    from: history.clone(forward ? stored.from : stored.to),
    to: history.clone(forward ? stored.to : stored.from),
  };
}

export function createVersionedStateHistory<State>(
  versionId: number | null,
  initialState: State,
  clone: (state: State) => State,
  options: VersionedStateHistoryOptions = {},
): VersionedStateHistory<State> {
  const snapshots = new Map<number, State>();
  const versionOrder: number[] = [];
  if (versionId !== null) {
    snapshots.set(versionId, clone(initialState));
    versionOrder.push(versionId);
  }
  return {
    currentVersionId: versionId,
    snapshots,
    clone,
    versionOrder,
    currentVersionIndex: versionId === null ? -1 : 0,
    transitions: [],
    pendingTransition: null,
    maxSnapshots: normalizeHistoryLimit(options.maxSnapshots),
  };
}

export function resetVersionedStateHistory<State>(
  history: VersionedStateHistory<State>,
  versionId: number | null,
  state: State,
): void {
  history.currentVersionId = versionId;
  history.snapshots.clear();
  history.versionOrder = [];
  history.currentVersionIndex = -1;
  history.transitions = [];
  history.pendingTransition = null;
  if (versionId !== null) {
    history.snapshots.set(versionId, history.clone(state));
    history.versionOrder.push(versionId);
    history.currentVersionIndex = 0;
  }
}

export function replaceCurrentVersionedState<State>(
  history: VersionedStateHistory<State>,
  state: State,
): void {
  const versionId = history.currentVersionId;
  if (versionId === null) {
    return;
  }
  history.snapshots.set(versionId, history.clone(state));
  history.transitions = history.transitions.map((transition) => ({
    ...transition,
    from:
      transition.fromVersionId === versionId
        ? history.clone(state)
        : transition.from,
    to:
      transition.toVersionId === versionId
        ? history.clone(state)
        : transition.to,
  }));
}

export function beginVersionedStateTransition<State>(
  history: VersionedStateHistory<State>,
  change: VersionedStateChange,
  stateBeforeChange: State,
): VersionedStateTransition<State> | null {
  const previousVersionId = history.currentVersionId;
  history.pendingTransition = null;

  if (!change.isUndoing && !change.isRedoing) {
    truncateRedoBranch(history);
    if (previousVersionId !== null) {
      history.snapshots.set(
        previousVersionId,
        history.clone(stateBeforeChange),
      );
    }
    history.currentVersionId = change.versionId;
    if (change.versionId !== null) {
      appendVersion(history, change.versionId);
      if (previousVersionId !== null) {
        history.pendingTransition = {
          fromVersionId: previousVersionId,
          toVersionId: change.versionId,
          from: history.clone(stateBeforeChange),
        };
      }
    }
    pruneVersionedStateHistory(history);
    return null;
  }

  history.currentVersionId = change.versionId;
  history.currentVersionIndex =
    change.versionId === null
      ? -1
      : history.versionOrder.indexOf(change.versionId);
  if (previousVersionId === null || change.versionId === null) {
    return null;
  }

  const storedTransition = findStoredTransition(
    history,
    previousVersionId,
    change.versionId,
  );
  if (storedTransition) {
    return storedTransition;
  }

  const targetSnapshot = history.snapshots.get(change.versionId);
  if (!targetSnapshot) {
    return null;
  }
  const sourceSnapshot = history.snapshots.get(previousVersionId);
  return {
    from: history.clone(sourceSnapshot ?? stateBeforeChange),
    to: history.clone(targetSnapshot),
  };
}

export function beginVersionedStateChange<State>(
  history: VersionedStateHistory<State>,
  change: VersionedStateChange,
  stateBeforeChange: State,
): State | null {
  return (
    beginVersionedStateTransition(history, change, stateBeforeChange)?.to ?? null
  );
}

export function commitVersionedStateChange<State>(
  history: VersionedStateHistory<State>,
  stateAfterChange: State,
): void {
  if (history.currentVersionId === null) {
    history.pendingTransition = null;
    return;
  }
  history.snapshots.set(
    history.currentVersionId,
    history.clone(stateAfterChange),
  );
  if (history.pendingTransition) {
    history.transitions = history.transitions.filter(
      (transition) =>
        transition.fromVersionId !== history.pendingTransition?.fromVersionId ||
        transition.toVersionId !== history.pendingTransition?.toVersionId,
    );
    history.transitions.push({
      ...history.pendingTransition,
      from: history.clone(history.pendingTransition.from),
      to: history.clone(stateAfterChange),
    });
  }
  history.pendingTransition = null;
  pruneVersionedStateHistory(history);
}

export type AnchorHistorySide = "left" | "right";

export type SideScopedAnchor = {
  leftLineNo: number;
  rightLineNo: number;
};

export type SideScopedStaleAnchorTracking = {
  leftLineNo: number | null;
  rightLineNo: number | null;
};

export type SideScopedStaleAnchor = {
  anchor: SideScopedAnchor;
  reason: string;
  tracking?: SideScopedStaleAnchorTracking;
};

export type SideScopedAnchorState = {
  manualAnchors: SideScopedAnchor[];
  staleManualAnchors: SideScopedStaleAnchor[];
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  selectedAnchorKey: string | null;
};

type AnchorRecord = {
  id: string;
  category: "active" | "stale";
  anchor: SideScopedAnchor;
  reason?: string;
  tracking?: SideScopedStaleAnchorTracking;
};

type TransitionAnchorPair = {
  from: AnchorRecord;
  to: AnchorRecord;
};

type CoalescedAnchorTransition = {
  direction: "collapse" | "expand";
  active: AnchorRecord;
  fromStale: AnchorRecord;
  toStale: AnchorRecord;
};

export type SideScopedAnchorTransitionResult<State> = {
  state: State;
  restoredAnchors: number;
  skippedAnchors: number;
};

export type SideScopedStaleReactivationRequest = Readonly<{
  side: AnchorHistorySide;
  staleAnchor: SideScopedStaleAnchor;
  targetAnchor: SideScopedAnchor;
}>;

export type SideScopedStaleReactivationResolution =
  | Readonly<{ status: "tracked"; oppositeLineNo: number }>
  | Readonly<{ status: "unresolved" }>;

export type SideScopedAnchorLineCounts = Readonly<{
  leftLineCount: number;
  rightLineCount: number;
}>;

export type SideScopedAnchorTransitionOptions = {
  allowStaleReactivation?: boolean;
  lineCounts?: SideScopedAnchorLineCounts;
  resolveStaleReactivation?: (
    request: SideScopedStaleReactivationRequest,
  ) => SideScopedStaleReactivationResolution;
};

function cloneAnchor(anchor: SideScopedAnchor): SideScopedAnchor {
  return { leftLineNo: anchor.leftLineNo, rightLineNo: anchor.rightLineNo };
}

function cloneStaleTracking(
  tracking: SideScopedStaleAnchorTracking | undefined,
): SideScopedStaleAnchorTracking | undefined {
  return tracking
    ? {
        leftLineNo: tracking.leftLineNo,
        rightLineNo: tracking.rightLineNo,
      }
    : undefined;
}

function anchorPairKey(anchor: SideScopedAnchor): string {
  return `${anchor.leftLineNo}:${anchor.rightLineNo}`;
}

function manualAnchorKey(anchor: SideScopedAnchor): string {
  return `manual:${anchorPairKey(anchor)}`;
}

function sideLine(anchor: SideScopedAnchor, side: AnchorHistorySide): number {
  return side === "left" ? anchor.leftLineNo : anchor.rightLineNo;
}

function oppositeLine(anchor: SideScopedAnchor, side: AnchorHistorySide): number {
  return side === "left" ? anchor.rightLineNo : anchor.leftLineNo;
}

function replaceSideLine(
  anchor: SideScopedAnchor,
  side: AnchorHistorySide,
  lineNo: number,
): SideScopedAnchor {
  return side === "left"
    ? { ...anchor, leftLineNo: lineNo }
    : { ...anchor, rightLineNo: lineNo };
}

function replaceOppositeLine(
  anchor: SideScopedAnchor,
  side: AnchorHistorySide,
  lineNo: number,
): SideScopedAnchor {
  return side === "left"
    ? { ...anchor, rightLineNo: lineNo }
    : { ...anchor, leftLineNo: lineNo };
}

type StaleReactivationPlan = {
  desiredAnchor: SideScopedAnchor | null;
  tracking?: SideScopedStaleAnchorTracking;
};

function createStaleReactivationTracking(
  targetAnchor: SideScopedAnchor,
  side: AnchorHistorySide,
  resolvedOppositeLineNo: number | null,
): SideScopedStaleAnchorTracking {
  const targetSideLineNo = sideLine(targetAnchor, side);
  const trackedSideLineNo =
    Number.isSafeInteger(targetSideLineNo) && targetSideLineNo >= 0
      ? targetSideLineNo
      : null;
  return side === "left"
    ? {
        leftLineNo: trackedSideLineNo,
        rightLineNo: resolvedOppositeLineNo,
      }
    : {
        leftLineNo: resolvedOppositeLineNo,
        rightLineNo: trackedSideLineNo,
      };
}

function resolveStaleReactivationPlan(
  currentStale: AnchorRecord,
  targetAnchor: SideScopedAnchor,
  side: AnchorHistorySide,
  options: SideScopedAnchorTransitionOptions,
): StaleReactivationPlan {
  const resolution: SideScopedStaleReactivationResolution =
    options.allowStaleReactivation === false
      ? { status: "unresolved" }
      : options.resolveStaleReactivation
        ? options.resolveStaleReactivation({
            side,
            staleAnchor: {
              anchor: cloneAnchor(currentStale.anchor),
              reason: currentStale.reason ?? "edit-unresolved",
              ...(currentStale.tracking
                ? { tracking: cloneStaleTracking(currentStale.tracking) }
                : {}),
            },
            targetAnchor: cloneAnchor(targetAnchor),
          })
        : {
            status: "tracked",
            oppositeLineNo: oppositeLine(currentStale.anchor, side),
          };
  const hasResolvedOppositeLine =
    resolution.status === "tracked" &&
    Number.isSafeInteger(resolution.oppositeLineNo) &&
    resolution.oppositeLineNo >= 0;
  const currentOppositeTracking = currentStale.tracking
    ? side === "left"
      ? currentStale.tracking.rightLineNo
      : currentStale.tracking.leftLineNo
    : null;
  const resolvedOppositeLineNo = hasResolvedOppositeLine
    ? resolution.oppositeLineNo
    : currentOppositeTracking;
  const tracking = currentStale.tracking
    ? createStaleReactivationTracking(
        targetAnchor,
        side,
        resolvedOppositeLineNo,
      )
    : undefined;
  if (!hasResolvedOppositeLine) {
    return { desiredAnchor: null, tracking };
  }
  return {
    desiredAnchor: replaceOppositeLine(
      replaceSideLine(
        currentStale.anchor,
        side,
        sideLine(targetAnchor, side),
      ),
      side,
      resolution.oppositeLineNo,
    ),
    tracking,
  };
}

function toAnchorRecords(state: SideScopedAnchorState): AnchorRecord[] {
  return [
    ...state.manualAnchors.map((anchor, index) => ({
      id: `active:${index}`,
      category: "active" as const,
      anchor: cloneAnchor(anchor),
    })),
    ...state.staleManualAnchors.map((item, index) => ({
      id: `stale:${index}`,
      category: "stale" as const,
      anchor: cloneAnchor(item.anchor),
      reason: item.reason,
      tracking: cloneStaleTracking(item.tracking),
    })),
  ];
}

function trackingForStaleTransition(
  current: AnchorRecord,
  target: AnchorRecord,
  side: AnchorHistorySide,
): SideScopedStaleAnchorTracking | undefined {
  if (target.category !== "stale") {
    return undefined;
  }
  const currentTracking = current.tracking;
  const targetTracking = target.tracking;
  if (!currentTracking && !targetTracking) {
    return undefined;
  }

  const currentLeftLineNo = currentTracking
    ? currentTracking.leftLineNo
    : current.category === "active"
      ? current.anchor.leftLineNo
      : targetTracking?.leftLineNo ?? null;
  const currentRightLineNo = currentTracking
    ? currentTracking.rightLineNo
    : current.category === "active"
      ? current.anchor.rightLineNo
      : targetTracking?.rightLineNo ?? null;
  const targetLeftLineNo = targetTracking
    ? targetTracking.leftLineNo
    : currentLeftLineNo;
  const targetRightLineNo = targetTracking
    ? targetTracking.rightLineNo
    : currentRightLineNo;

  return side === "left"
    ? {
        leftLineNo: targetLeftLineNo,
        rightLineNo: currentRightLineNo,
      }
    : {
        leftLineNo: currentLeftLineNo,
        rightLineNo: targetRightLineNo,
      };
}

function findUniqueRecord(
  records: readonly AnchorRecord[],
  predicate: (record: AnchorRecord) => boolean,
  usedIds?: ReadonlySet<string>,
): AnchorRecord | null {
  const matches = records.filter(
    (record) => !usedIds?.has(record.id) && predicate(record),
  );
  return matches.length === 1 ? matches[0] : null;
}

function findUniqueCurrentStaleRecord(
  records: readonly AnchorRecord[],
  reference: AnchorRecord,
  side: AnchorHistorySide,
  usedIds: ReadonlySet<string>,
): AnchorRecord | null {
  const candidates = records.filter(
    (record) =>
      !usedIds.has(record.id) &&
      record.category === "stale" &&
      (reference.reason === undefined || record.reason === reference.reason),
  );
  const exactMatches = candidates.filter(
    (record) =>
      anchorPairKey(record.anchor) === anchorPairKey(reference.anchor),
  );
  if (exactMatches.length > 0) {
    return exactMatches.length === 1 ? exactMatches[0] : null;
  }
  const sideMatches = candidates.filter(
    (record) =>
      sideLine(record.anchor, side) === sideLine(reference.anchor, side),
  );
  return sideMatches.length === 1 ? sideMatches[0] : null;
}

function pairTransitionAnchors(
  fromState: SideScopedAnchorState,
  toState: SideScopedAnchorState,
  side: AnchorHistorySide,
): {
  pairs: TransitionAnchorPair[];
  coalesced: CoalescedAnchorTransition[];
  skipped: number;
} {
  const fromRecords = toAnchorRecords(fromState);
  const toRecords = toAnchorRecords(toState);
  const usedFromIds = new Set<string>();
  const usedToIds = new Set<string>();
  const pairs: TransitionAnchorPair[] = [];
  const coalesced: CoalescedAnchorTransition[] = [];
  let skipped = 0;

  const pairKeys = new Set(
    [...fromRecords, ...toRecords].map((record) => anchorPairKey(record.anchor)),
  );
  pairKeys.forEach((pairKey) => {
    const fromAtPair = fromRecords.filter(
      (record) => anchorPairKey(record.anchor) === pairKey,
    );
    const toAtPair = toRecords.filter(
      (record) => anchorPairKey(record.anchor) === pairKey,
    );
    const fromActive = fromAtPair.filter(
      (record) => record.category === "active",
    );
    const fromStale = fromAtPair.filter(
      (record) => record.category === "stale",
    );
    const toActive = toAtPair.filter(
      (record) => record.category === "active",
    );
    const toStale = toAtPair.filter(
      (record) => record.category === "stale",
    );
    const staleIsUnchanged =
      fromStale.length === 1 &&
      toStale.length === 1 &&
      fromStale[0].reason === toStale[0].reason;
    if (
      staleIsUnchanged &&
      fromActive.length === 1 &&
      toActive.length === 0
    ) {
      coalesced.push({
        direction: "collapse",
        active: fromActive[0],
        fromStale: fromStale[0],
        toStale: toStale[0],
      });
      usedFromIds.add(fromActive[0].id);
      usedFromIds.add(fromStale[0].id);
      usedToIds.add(toStale[0].id);
      return;
    }
    if (
      staleIsUnchanged &&
      fromActive.length === 0 &&
      toActive.length === 1
    ) {
      coalesced.push({
        direction: "expand",
        active: toActive[0],
        fromStale: fromStale[0],
        toStale: toStale[0],
      });
      usedFromIds.add(fromStale[0].id);
      usedToIds.add(toActive[0].id);
      usedToIds.add(toStale[0].id);
    }
  });

  fromRecords.forEach((from) => {
    if (usedFromIds.has(from.id)) {
      return;
    }
    let to: AnchorRecord | null = null;
    if (from.category === "active") {
      to = findUniqueRecord(
        toRecords,
        (candidate) =>
          candidate.category === "active" &&
          oppositeLine(candidate.anchor, side) === oppositeLine(from.anchor, side),
        usedToIds,
      );
      if (!to) {
        to = findUniqueRecord(
          toRecords,
          (candidate) =>
            candidate.category === "stale" &&
            anchorPairKey(candidate.anchor) === anchorPairKey(from.anchor),
          usedToIds,
        );
      }
    } else {
      to = findUniqueRecord(
        toRecords,
        (candidate) =>
          anchorPairKey(candidate.anchor) === anchorPairKey(from.anchor),
        usedToIds,
      );
    }
    if (!to) {
      skipped += 1;
      return;
    }
    usedToIds.add(to.id);
    pairs.push({ from, to });
  });
  skipped += toRecords.filter((record) => !usedToIds.has(record.id)).length;
  return { pairs, coalesced, skipped };
}

function selectedRecord(
  state: SideScopedAnchorState,
  records: readonly AnchorRecord[],
): AnchorRecord | null {
  if (!state.selectedAnchorKey?.startsWith("manual:")) {
    return null;
  }
  return findUniqueRecord(
    records,
    (record) =>
      record.category === "active" &&
      manualAnchorKey(record.anchor) === state.selectedAnchorKey,
  );
}

export function applySideScopedAnchorTransition<
  State extends SideScopedAnchorState,
>(
  currentState: State,
  side: AnchorHistorySide,
  transition: VersionedStateTransition<State>,
  options: SideScopedAnchorTransitionOptions = {},
): SideScopedAnchorTransitionResult<State> {
  const currentRecords = toAnchorRecords(currentState);
  const fromRecords = toAnchorRecords(transition.from);
  const toRecords = toAnchorRecords(transition.to);
  const pairing = pairTransitionAnchors(transition.from, transition.to, side);
  const usedCurrentIds = new Set<string>();
  const plans = new Map<string, TransitionAnchorPair>();
  const plannedAnchors = new Map<string, SideScopedAnchor>();
  const plannedStaleTrackings = new Map<
    string,
    SideScopedStaleAnchorTracking | undefined
  >();
  const staleTrackingOverrides = new Map<
    string,
    SideScopedStaleAnchorTracking
  >();
  const removedCurrentIds = new Set<string>();
  const addedRecords: AnchorRecord[] = [];
  const addedRecordIds = new Set<string>();
  const appliedCoalesced: {
    transition: CoalescedAnchorTransition;
    liveActiveId?: string;
    addedActiveId?: string;
  }[] = [];
  let skippedAnchors = pairing.skipped;

  pairing.pairs.forEach((pair) => {
    let current =
      pair.from.category === "active"
        ? findUniqueRecord(
            currentRecords,
            (record) =>
              record.category === "active" &&
              sideLine(record.anchor, side) === sideLine(pair.from.anchor, side),
            usedCurrentIds,
          )
        : findUniqueCurrentStaleRecord(
            currentRecords,
            pair.from,
            side,
            usedCurrentIds,
          );
    if (
      !current &&
      pair.from.category === "active" &&
      pair.to.category === "stale"
    ) {
      current = findUniqueCurrentStaleRecord(
        currentRecords,
        pair.to,
        side,
        usedCurrentIds,
      );
    }
    if (!current) {
      skippedAnchors += 1;
      return;
    }
    const reactivation =
      pair.from.category === "stale" && pair.to.category === "active"
        ? resolveStaleReactivationPlan(
            current,
            pair.to.anchor,
            side,
            options,
          )
        : null;
    if (reactivation?.tracking) {
      staleTrackingOverrides.set(current.id, reactivation.tracking);
    }
    const desiredAnchor = reactivation
      ? reactivation.desiredAnchor
      : replaceSideLine(
          current.anchor,
          side,
          sideLine(pair.to.anchor, side),
        );
    if (!desiredAnchor) {
      skippedAnchors += 1;
      return;
    }
    usedCurrentIds.add(current.id);
    plans.set(current.id, pair);
    plannedAnchors.set(current.id, desiredAnchor);
    plannedStaleTrackings.set(
      current.id,
      trackingForStaleTransition(current, pair.to, side),
    );
  });

  pairing.coalesced.forEach((coalesced, index) => {
    if (coalesced.direction === "collapse") {
      const currentActive = findUniqueRecord(
        currentRecords,
        (record) =>
          record.category === "active" &&
          sideLine(record.anchor, side) ===
            sideLine(coalesced.active.anchor, side),
        usedCurrentIds,
      );
      const currentStale = findUniqueCurrentStaleRecord(
        currentRecords,
        coalesced.fromStale,
        side,
        usedCurrentIds,
      );
      if (!currentStale) {
        skippedAnchors += 1;
        return;
      }
      usedCurrentIds.add(currentStale.id);
      const nextStaleTracking = trackingForStaleTransition(
        currentStale,
        coalesced.toStale,
        side,
      );
      if (nextStaleTracking) {
        staleTrackingOverrides.set(currentStale.id, nextStaleTracking);
      }
      if (!currentActive) {
        skippedAnchors += 1;
        return;
      }
      usedCurrentIds.add(currentActive.id);
      removedCurrentIds.add(currentActive.id);
      appliedCoalesced.push({
        transition: coalesced,
        liveActiveId: currentActive.id,
      });
      return;
    }

    const currentStale = findUniqueCurrentStaleRecord(
      currentRecords,
      coalesced.fromStale,
      side,
      usedCurrentIds,
    );
    const reactivation = currentStale
      ? resolveStaleReactivationPlan(
          currentStale,
          coalesced.active.anchor,
          side,
          options,
        )
      : null;
    if (currentStale && reactivation?.tracking) {
      staleTrackingOverrides.set(currentStale.id, reactivation.tracking);
    }
    const desiredAnchor = reactivation?.desiredAnchor ?? null;
    const conflictsWithActive = desiredAnchor
      ? currentRecords.some(
          (record) =>
            record.category === "active" &&
            (record.anchor.leftLineNo === desiredAnchor.leftLineNo ||
              record.anchor.rightLineNo === desiredAnchor.rightLineNo),
        )
      : true;
    if (!currentStale || !desiredAnchor || conflictsWithActive) {
      skippedAnchors += 1;
      return;
    }
    usedCurrentIds.add(currentStale.id);
    const addedActiveId = `added-active:${index}`;
    addedRecordIds.add(addedActiveId);
    addedRecords.push({
      id: addedActiveId,
      category: "active",
      anchor: desiredAnchor,
    });
    appliedCoalesced.push({
      transition: coalesced,
      addedActiveId,
    });
  });

  const plannedRecords = [
    ...currentRecords
      .filter((record) => !removedCurrentIds.has(record.id))
      .map((record): AnchorRecord => {
        const pair = plans.get(record.id);
        if (!pair) {
          return {
            ...record,
            anchor: cloneAnchor(record.anchor),
            tracking: cloneStaleTracking(
              staleTrackingOverrides.get(record.id) ?? record.tracking,
            ),
          };
        }
        return {
          ...record,
          category: pair.to.category,
          anchor: cloneAnchor(plannedAnchors.get(record.id) ?? record.anchor),
          reason: pair.to.reason,
          tracking: cloneStaleTracking(plannedStaleTrackings.get(record.id)),
        };
      }),
    ...addedRecords,
  ];

  const invalidPlanIds = new Set<string>();
  const pairGroups = new Map<string, AnchorRecord[]>();
  plannedRecords.forEach((record) => {
    const key = `${record.category}:${anchorPairKey(record.anchor)}`;
    const group = pairGroups.get(key) ?? [];
    group.push(record);
    pairGroups.set(key, group);
  });
  pairGroups.forEach((records) => {
    if (records.length > 1) {
      records.forEach((record) => {
        if (plans.has(record.id) || addedRecordIds.has(record.id)) {
          invalidPlanIds.add(record.id);
        }
      });
    }
  });

  const activeByLeft = new Map<number, AnchorRecord[]>();
  const activeByRight = new Map<number, AnchorRecord[]>();
  plannedRecords
    .filter((record) => record.category === "active")
    .forEach((record) => {
      const left = activeByLeft.get(record.anchor.leftLineNo) ?? [];
      left.push(record);
      activeByLeft.set(record.anchor.leftLineNo, left);
      const right = activeByRight.get(record.anchor.rightLineNo) ?? [];
      right.push(record);
      activeByRight.set(record.anchor.rightLineNo, right);
    });
  [...activeByLeft.values(), ...activeByRight.values()].forEach((records) => {
    if (records.length > 1) {
      records.forEach((record) => {
        if (plans.has(record.id) || addedRecordIds.has(record.id)) {
          invalidPlanIds.add(record.id);
        }
      });
    }
  });

  const isCandidateRecord = (record: AnchorRecord): boolean =>
    plans.has(record.id) || addedRecordIds.has(record.id);
  const isAnchorCoordinateValid = (anchor: SideScopedAnchor): boolean => {
    if (
      !Number.isSafeInteger(anchor.leftLineNo) ||
      !Number.isSafeInteger(anchor.rightLineNo) ||
      anchor.leftLineNo < 0 ||
      anchor.rightLineNo < 0
    ) {
      return false;
    }
    return options.lineCounts
      ? anchor.leftLineNo < options.lineCounts.leftLineCount &&
          anchor.rightLineNo < options.lineCounts.rightLineCount
      : true;
  };
  const orderedActiveRecords = plannedRecords
    .filter((record) => record.category === "active")
    .filter((record) => {
      const valid = isAnchorCoordinateValid(record.anchor);
      if (!valid && isCandidateRecord(record)) {
        invalidPlanIds.add(record.id);
      }
      return valid;
    })
    .sort(
      (left, right) =>
        left.anchor.leftLineNo - right.anchor.leftLineNo ||
        left.anchor.rightLineNo - right.anchor.rightLineNo,
    );
  const maximumRightBefore = new Array<number>(orderedActiveRecords.length);
  const minimumRightAfter = new Array<number>(orderedActiveRecords.length);
  let maximumRight = Number.NEGATIVE_INFINITY;
  orderedActiveRecords.forEach((record, index) => {
    maximumRightBefore[index] = maximumRight;
    maximumRight = Math.max(maximumRight, record.anchor.rightLineNo);
  });
  let minimumRight = Number.POSITIVE_INFINITY;
  for (let index = orderedActiveRecords.length - 1; index >= 0; index -= 1) {
    minimumRightAfter[index] = minimumRight;
    minimumRight = Math.min(
      minimumRight,
      orderedActiveRecords[index].anchor.rightLineNo,
    );
  }
  orderedActiveRecords.forEach((record, index) => {
    if (
      isCandidateRecord(record) &&
      (maximumRightBefore[index] >= record.anchor.rightLineNo ||
        minimumRightAfter[index] <= record.anchor.rightLineNo)
    ) {
      invalidPlanIds.add(record.id);
    }
  });

  invalidPlanIds.forEach((id) => {
    const removedPlan = plans.delete(id);
    plannedAnchors.delete(id);
    plannedStaleTrackings.delete(id);
    const removedAddition = addedRecordIds.delete(id);
    if (removedPlan || removedAddition) {
      skippedAnchors += 1;
    }
  });

  const finalRecords = [
    ...currentRecords
      .filter((record) => !removedCurrentIds.has(record.id))
      .map((record): AnchorRecord => {
        const pair = plans.get(record.id);
        if (!pair) {
          return {
            ...record,
            anchor: cloneAnchor(record.anchor),
            tracking: cloneStaleTracking(
              staleTrackingOverrides.get(record.id) ?? record.tracking,
            ),
          };
        }
        return {
          ...record,
          category: pair.to.category,
          anchor: cloneAnchor(plannedAnchors.get(record.id) ?? record.anchor),
          reason: pair.to.reason,
          tracking: cloneStaleTracking(plannedStaleTrackings.get(record.id)),
        };
      }),
    ...addedRecords.filter((record) => addedRecordIds.has(record.id)),
  ];

  const manualAnchors = finalRecords
    .filter((record) => record.category === "active")
    .map((record) => cloneAnchor(record.anchor))
    .sort((a, b) => a.leftLineNo - b.leftLineNo);
  const staleManualAnchors = finalRecords
    .filter((record) => record.category === "stale")
    .map((record) => ({
      anchor: cloneAnchor(record.anchor),
      reason: record.reason ?? "edit-unresolved",
      ...(record.tracking
        ? { tracking: cloneStaleTracking(record.tracking) }
        : {}),
    }));

  let selectedAnchorKey = currentState.selectedAnchorKey;
  const currentSelected = selectedRecord(currentState, currentRecords);
  const fromSelected = selectedRecord(transition.from, fromRecords);
  const toSelected = selectedRecord(transition.to, toRecords);
  const currentSelectedPlan = currentSelected
    ? plans.get(currentSelected.id)
    : undefined;
  if (currentSelected && currentSelectedPlan) {
    const finalRecord = finalRecords.find(
      (record) => record.id === currentSelected.id,
    );
    selectedAnchorKey =
      finalRecord?.category === "active"
        ? manualAnchorKey(finalRecord.anchor)
        : null;
  }
  const selectedPair = pairing.pairs.find(
    (pair) =>
      pair.from.id === fromSelected?.id || pair.to.id === toSelected?.id,
  );
  if (selectedPair) {
    const liveRecord = currentRecords.find(
      (record) => plans.get(record.id) === selectedPair,
    );
    const currentSelectionIsCompatible =
      currentSelected === null || currentSelected.id === liveRecord?.id;
    if (liveRecord && currentSelectionIsCompatible) {
      const finalRecord = finalRecords.find((record) => record.id === liveRecord.id);
      selectedAnchorKey =
        toSelected && finalRecord?.category === "active"
          ? manualAnchorKey(finalRecord.anchor)
          : null;
    }
  }
  appliedCoalesced.forEach((applied) => {
    if (
      applied.addedActiveId &&
      !addedRecordIds.has(applied.addedActiveId)
    ) {
      return;
    }
    const transitionActiveKey = manualAnchorKey(
      applied.transition.active.anchor,
    );
    if (applied.transition.direction === "collapse") {
      const liveActive = currentRecords.find(
        (record) => record.id === applied.liveActiveId,
      );
      if (currentSelected?.id === applied.liveActiveId) {
        selectedAnchorKey = null;
      }
      if (
        transition.from.selectedAnchorKey === transitionActiveKey &&
        liveActive &&
        currentState.selectedAnchorKey === manualAnchorKey(liveActive.anchor)
      ) {
        selectedAnchorKey = null;
      }
      return;
    }
    if (
      transition.to.selectedAnchorKey === transitionActiveKey &&
      currentState.selectedAnchorKey === null
    ) {
      const addedActive = finalRecords.find(
        (record) => record.id === applied.addedActiveId,
      );
      if (addedActive) {
        selectedAnchorKey = manualAnchorKey(addedActive.anchor);
      }
    }
  });
  if (
    selectedAnchorKey?.startsWith("manual:") &&
    !manualAnchors.some((anchor) => manualAnchorKey(anchor) === selectedAnchorKey)
  ) {
    selectedAnchorKey = null;
  }

  const state = {
    ...currentState,
    manualAnchors,
    staleManualAnchors,
    pendingLeftLineNo:
      side === "left"
        ? transition.to.pendingLeftLineNo
        : currentState.pendingLeftLineNo,
    pendingRightLineNo:
      side === "right"
        ? transition.to.pendingRightLineNo
        : currentState.pendingRightLineNo,
    selectedAnchorKey,
  };

  return {
    state,
    restoredAnchors:
      plans.size +
      appliedCoalesced.filter(
        (applied) =>
          !applied.addedActiveId || addedRecordIds.has(applied.addedActiveId),
      ).length,
    skippedAnchors,
  };
}
