import { validateAnchors, type Anchor } from "../diffEngine/anchors";
import type {
  StaleAnchorReason,
  StaleManualAnchor,
  WorkspaceAnchorState,
} from "../storage/workspaces";
import {
  createAnchorAppendLineMapper,
  createAnchorReloadLineMapper,
  type AnchorReloadLineMapper,
  type AnchorReloadPaneSnapshot,
} from "./anchorReload";
import { createAnchorEncodingLineMapper } from "./anchorEncoding";
import { recoverUnambiguousStaleAnchors } from "./staleAnchorRecovery";
import {
  prepareContentChanges,
  transformAnchorsWithPreparedChanges,
  transformTrackedLineWithPreparedChanges,
  type AnchorSide,
  type ContentChangeLike,
  type ContentChangeTrackingContext,
  type TrackedAnchorResult,
} from "./anchorTracking";

export type AnchorLineCounts = {
  leftLineCount: number;
  rightLineCount: number;
};

export type AnchorLifecycleResult = {
  state: WorkspaceAnchorState;
  moved: number;
  recovered: number;
  pendingCleared: boolean;
  staleAdded: number;
  validationDeferred: boolean;
  validationOrigins: readonly DeferredAnchorValidationOrigin[];
  paneSnapshotTransition?: PreparedPaneSnapshotAnchorTransition;
};

export type DeferredAnchorValidationOrigin = Readonly<{
  anchor: Anchor;
  original: Anchor;
}>;

export type PreparedPaneSnapshotAnchorTransition = Readonly<{
  baseAnchors: readonly Anchor[];
  side: AnchorSide;
  mapLine: AnchorReloadLineMapper;
}>;

export type PaneSnapshotAnchorRebaseOptions = Readonly<{
  deferValidation?: boolean;
  validationOrigins?: readonly DeferredAnchorValidationOrigin[];
}>;

export type ContentChangeAnchorUpdateOptions =
  PaneSnapshotAnchorRebaseOptions &
    Readonly<{
      trackingContext?: ContentChangeTrackingContext;
    }>;

type ReconcileMappedAnchorOptions = PaneSnapshotAnchorRebaseOptions &
  Readonly<{
    originalAnchors?: readonly (Anchor | undefined)[];
  }>;

type LineMappingResult =
  | { status: "mapped"; lineNo: number }
  | { status: "stale" };

function anchorPairKey(anchor: Anchor): string {
  return `${anchor.leftLineNo}:${anchor.rightLineNo}`;
}

function manualAnchorKey(anchor: Anchor): string {
  return `manual:${anchorPairKey(anchor)}`;
}

function cloneAnchor(anchor: Anchor): Anchor {
  return { leftLineNo: anchor.leftLineNo, rightLineNo: anchor.rightLineNo };
}

function cloneStaleAnchor(item: StaleManualAnchor): StaleManualAnchor {
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

function createUnresolvedTracking(
  anchor: Anchor,
  side: AnchorSide,
): NonNullable<StaleManualAnchor["tracking"]> {
  return side === "left"
    ? { leftLineNo: null, rightLineNo: anchor.rightLineNo }
    : { leftLineNo: anchor.leftLineNo, rightLineNo: null };
}

function mapStaleAnchorTracking(
  item: StaleManualAnchor,
  side: AnchorSide,
  mapLine: (lineNo: number) => LineMappingResult,
): StaleManualAnchor {
  const clone = cloneStaleAnchor(item);
  if (!clone.tracking) {
    return clone;
  }
  const lineNo =
    side === "left"
      ? clone.tracking.leftLineNo
      : clone.tracking.rightLineNo;
  if (lineNo === null) {
    return clone;
  }
  const mapped = mapLine(lineNo);
  if (side === "left") {
    clone.tracking.leftLineNo =
      mapped.status === "mapped" ? mapped.lineNo : null;
  } else {
    clone.tracking.rightLineNo =
      mapped.status === "mapped" ? mapped.lineNo : null;
  }
  return clone;
}

function buildValidationOriginsByAnchor(
  origins: readonly DeferredAnchorValidationOrigin[] | undefined,
): Map<string, Anchor> {
  const result = new Map<string, Anchor>();
  origins?.forEach((item) => {
    result.set(anchorPairKey(item.anchor), item.original);
  });
  return result;
}

function mapAnchorSide(
  anchor: Anchor,
  side: AnchorSide,
  lineNo: number,
): Anchor {
  return side === "left"
    ? { ...anchor, leftLineNo: lineNo }
    : { ...anchor, rightLineNo: lineNo };
}

function reconcileMappedAnchors(
  state: WorkspaceAnchorState,
  side: AnchorSide,
  mappedAnchors: readonly TrackedAnchorResult[],
  mapPendingLine: (lineNo: number) => LineMappingResult,
  staleReason: StaleAnchorReason,
  lineCounts: AnchorLineCounts,
  options: ReconcileMappedAnchorOptions = {},
): AnchorLifecycleResult {
  let staleManualAnchors = (state.staleManualAnchors ?? []).map((item) =>
    mapStaleAnchorTracking(item, side, mapPendingLine),
  );
  const stalePairKeys = new Set(
    staleManualAnchors.map((item) => anchorPairKey(item.anchor)),
  );
  const originalByMappedAnchor = new Map<Anchor, Anchor>();
  const activeCandidates: Anchor[] = [];
  const activeCandidateOrigins: DeferredAnchorValidationOrigin[] = [];
  let selectedAnchorKey = state.selectedAnchorKey?.startsWith("auto:")
    ? null
    : state.selectedAnchorKey;
  let moved = 0;
  let staleAdded = 0;

  const addStale = (
    anchor: Anchor,
    tracking: NonNullable<StaleManualAnchor["tracking"]>,
  ): void => {
    const key = anchorPairKey(anchor);
    if (stalePairKeys.has(key)) {
      // The same historical display coordinate can represent a different
      // logical anchor generation. Combining their tracking candidates could
      // reactivate the wrong one, so retain the audit coordinate but discard
      // every automatic recovery candidate at that coordinate.
      staleManualAnchors.forEach((item) => {
        if (anchorPairKey(item.anchor) === key) {
          delete item.tracking;
        }
      });
      return;
    }
    stalePairKeys.add(key);
    staleManualAnchors.push({
      anchor: cloneAnchor(anchor),
      reason: staleReason,
      tracking: { ...tracking },
    });
    staleAdded += 1;
  };

  mappedAnchors.forEach((result, index) => {
    const current = state.manualAnchors[index];
    if (!current) {
      return;
    }
    const original = options.originalAnchors?.[index] ?? current;
    const wasSelected = selectedAnchorKey === manualAnchorKey(current);
    if (result.stale) {
      addStale(original, createUnresolvedTracking(current, side));
      if (wasSelected) {
        selectedAnchorKey = null;
      }
      return;
    }
    const mapped = cloneAnchor(result.anchor);
    activeCandidates.push(mapped);
    originalByMappedAnchor.set(mapped, original);
    activeCandidateOrigins.push({
      anchor: cloneAnchor(mapped),
      original: cloneAnchor(original),
    });
    if (anchorPairKey(mapped) !== anchorPairKey(current)) {
      moved += 1;
    }
    if (wasSelected) {
      selectedAnchorKey = manualAnchorKey(mapped);
    }
  });

  const validation = validateAnchors(
    activeCandidates,
    lineCounts.leftLineCount,
    lineCounts.rightLineCount,
  );
  const validationDeferred =
    options.deferValidation === true && validation.invalid.length > 0;
  if (!validationDeferred) {
    validation.invalid.forEach((issue) => {
      const original = originalByMappedAnchor.get(issue.anchor) ?? issue.anchor;
      addStale(original, cloneAnchor(issue.anchor));
      if (selectedAnchorKey === manualAnchorKey(issue.anchor)) {
        selectedAnchorKey = null;
      }
    });
  }

  let pendingLeftLineNo = state.pendingLeftLineNo;
  let pendingRightLineNo = state.pendingRightLineNo;
  const pendingLineNo = side === "left" ? pendingLeftLineNo : pendingRightLineNo;
  let pendingCleared = false;
  if (pendingLineNo !== null) {
    const pendingResult = mapPendingLine(pendingLineNo);
    if (pendingResult.status === "mapped") {
      if (side === "left") {
        pendingLeftLineNo = pendingResult.lineNo;
      } else {
        pendingRightLineNo = pendingResult.lineNo;
      }
    } else {
      pendingCleared = true;
      if (side === "left") {
        pendingLeftLineNo = null;
      } else {
        pendingRightLineNo = null;
      }
    }
  }

  const activeAnchors = (validationDeferred
    ? activeCandidates
    : validation.valid
  ).map(cloneAnchor);
  const recovery = validationDeferred
    ? {
        manualAnchors: activeAnchors,
        staleManualAnchors,
        recovered: 0,
      }
    : recoverUnambiguousStaleAnchors(
        activeAnchors,
        staleManualAnchors,
        lineCounts,
      );
  staleManualAnchors = recovery.staleManualAnchors;

  return {
    state: {
      manualAnchors: recovery.manualAnchors,
      staleManualAnchors,
      autoAnchor: state.autoAnchor ? cloneAnchor(state.autoAnchor) : null,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      pendingLeftLineNo,
      pendingRightLineNo,
      selectedAnchorKey,
    },
    moved,
    recovered: recovery.recovered,
    pendingCleared,
    staleAdded,
    validationDeferred,
    validationOrigins:
      options.deferValidation === true ? activeCandidateOrigins : [],
  };
}

export function updateAnchorStateForContentChanges(
  state: WorkspaceAnchorState,
  side: AnchorSide,
  changes: readonly ContentChangeLike[],
  lineCounts: AnchorLineCounts,
  options: ContentChangeAnchorUpdateOptions = {},
): AnchorLifecycleResult {
  const preparedChanges = prepareContentChanges(changes);
  const originsByAnchor = buildValidationOriginsByAnchor(
    options.validationOrigins,
  );
  const originalAnchors = state.manualAnchors.map((anchor) =>
    originsByAnchor.get(anchorPairKey(anchor)),
  );
  const mappedAnchors = transformAnchorsWithPreparedChanges(
    state.manualAnchors,
    side,
    preparedChanges,
    options.trackingContext,
  );
  return reconcileMappedAnchors(
    state,
    side,
    mappedAnchors,
    (lineNo) => {
      const result = transformTrackedLineWithPreparedChanges(
        lineNo,
        preparedChanges,
        options.trackingContext,
      );
      return result.stale
        ? { status: "stale" }
        : { status: "mapped", lineNo: result.lineNo };
    },
    "edit-unresolved",
    lineCounts,
    { ...options, originalAnchors },
  );
}

export function updateAnchorStateForPaneReload(
  state: WorkspaceAnchorState,
  side: AnchorSide,
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
  lineCounts: AnchorLineCounts,
): AnchorLifecycleResult {
  return updateAnchorStateForPaneSnapshotChange(
    state,
    side,
    createAnchorReloadLineMapper(previous, next),
    lineCounts,
  );
}

export function updateAnchorStateForPaneEncodingChange(
  state: WorkspaceAnchorState,
  side: AnchorSide,
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
  lineCounts: AnchorLineCounts,
): AnchorLifecycleResult {
  return updateAnchorStateForPaneSnapshotChange(
    state,
    side,
    createAnchorEncodingLineMapper(previous, next),
    lineCounts,
  );
}

export function updateAnchorStateForPaneAppend(
  state: WorkspaceAnchorState,
  side: AnchorSide,
  previous: AnchorReloadPaneSnapshot,
  next: AnchorReloadPaneSnapshot,
  lineCounts: AnchorLineCounts,
): AnchorLifecycleResult {
  return updateAnchorStateForPaneSnapshotChange(
    state,
    side,
    createAnchorAppendLineMapper(previous, next),
    lineCounts,
  );
}

function updateAnchorStateForPaneSnapshotChange(
  state: WorkspaceAnchorState,
  side: AnchorSide,
  mapReloadedLine: AnchorReloadLineMapper,
  lineCounts: AnchorLineCounts,
): AnchorLifecycleResult {
  const transition = {
    baseAnchors: state.manualAnchors.map(cloneAnchor),
    side,
    mapLine: mapReloadedLine,
  };
  return applyPreparedPaneSnapshotAnchorTransition(
    state,
    transition,
    lineCounts,
  );
}

function applyPreparedPaneSnapshotAnchorTransition(
  state: WorkspaceAnchorState,
  transition: PreparedPaneSnapshotAnchorTransition,
  lineCounts: AnchorLineCounts,
  options: PaneSnapshotAnchorRebaseOptions = {},
): AnchorLifecycleResult {
  const { side, mapLine: mapReloadedLine } = transition;
  const originsByAnchor = buildValidationOriginsByAnchor(
    options.validationOrigins,
  );
  const baseAnchorsByTargetLine = new Map<number, Anchor | null>();
  transition.baseAnchors.forEach((anchor) => {
    const lineNo = side === "left" ? anchor.leftLineNo : anchor.rightLineNo;
    baseAnchorsByTargetLine.set(
      lineNo,
      baseAnchorsByTargetLine.has(lineNo) ? null : anchor,
    );
  });
  const originalAnchors = state.manualAnchors.map((anchor) => {
    const carriedOrigin = originsByAnchor.get(anchorPairKey(anchor));
    if (carriedOrigin) {
      return carriedOrigin;
    }
    const lineNo = side === "left" ? anchor.leftLineNo : anchor.rightLineNo;
    return baseAnchorsByTargetLine.get(lineNo) ?? undefined;
  });
  const mappedAnchors = state.manualAnchors.map((anchor): TrackedAnchorResult => {
    const currentLineNo = side === "left" ? anchor.leftLineNo : anchor.rightLineNo;
    const result = mapReloadedLine(currentLineNo);
    return result.status === "mapped"
      ? { anchor: mapAnchorSide(anchor, side, result.lineNo), stale: false }
      : { anchor: cloneAnchor(anchor), stale: true };
  });
  const result = reconcileMappedAnchors(
    state,
    side,
    mappedAnchors,
    (lineNo) => {
      const result = mapReloadedLine(lineNo);
      return result.status === "mapped"
        ? { status: "mapped", lineNo: result.lineNo }
        : { status: "stale" };
    },
    "reload-unresolved",
    lineCounts,
    { ...options, originalAnchors },
  );
  return { ...result, paneSnapshotTransition: transition };
}

export function rebasePaneSnapshotAnchorLifecycleResult(
  prepared: AnchorLifecycleResult,
  currentState: WorkspaceAnchorState,
  lineCounts: AnchorLineCounts,
  options: PaneSnapshotAnchorRebaseOptions = {},
): AnchorLifecycleResult {
  return prepared.paneSnapshotTransition
    ? applyPreparedPaneSnapshotAnchorTransition(
        currentState,
        prepared.paneSnapshotTransition,
        lineCounts,
        options,
      )
    : prepared;
}

export function finalizeDeferredAnchorValidation(
  state: WorkspaceAnchorState,
  lineCounts: AnchorLineCounts,
  validationOrigins: readonly DeferredAnchorValidationOrigin[] = [],
): AnchorLifecycleResult {
  const validation = validateAnchors(
    state.manualAnchors,
    lineCounts.leftLineCount,
    lineCounts.rightLineCount,
  );
  let staleManualAnchors = (state.staleManualAnchors ?? []).map(cloneStaleAnchor);
  const stalePairKeys = new Set(
    staleManualAnchors.map((item) => anchorPairKey(item.anchor)),
  );
  let selectedAnchorKey = state.selectedAnchorKey;
  let staleAdded = 0;
  const originsByAnchor = buildValidationOriginsByAnchor(validationOrigins);

  validation.invalid.forEach((issue) => {
    const original = originsByAnchor.get(anchorPairKey(issue.anchor)) ?? issue.anchor;
    const key = anchorPairKey(original);
    if (!stalePairKeys.has(key)) {
      stalePairKeys.add(key);
      staleManualAnchors.push({
        anchor: cloneAnchor(original),
        reason: "reload-unresolved",
        tracking: cloneAnchor(issue.anchor),
      });
      staleAdded += 1;
    }
    if (selectedAnchorKey === manualAnchorKey(issue.anchor)) {
      selectedAnchorKey = null;
    }
  });

  const recovery = recoverUnambiguousStaleAnchors(
    validation.valid,
    staleManualAnchors,
    lineCounts,
  );
  staleManualAnchors = recovery.staleManualAnchors;

  return {
    state: {
      manualAnchors: recovery.manualAnchors,
      staleManualAnchors,
      autoAnchor: state.autoAnchor ? cloneAnchor(state.autoAnchor) : null,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      pendingLeftLineNo: state.pendingLeftLineNo,
      pendingRightLineNo: state.pendingRightLineNo,
      selectedAnchorKey,
    },
    moved: 0,
    recovered: recovery.recovered,
    pendingCleared: false,
    staleAdded,
    validationDeferred: false,
    validationOrigins: [],
  };
}
