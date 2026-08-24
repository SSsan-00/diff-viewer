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
import {
  prepareContentChanges,
  transformAnchorsWithPreparedChanges,
  transformTrackedLineWithPreparedChanges,
  type AnchorSide,
  type ContentChangeLike,
  type TrackedAnchorResult,
} from "./anchorTracking";

export type AnchorLineCounts = {
  leftLineCount: number;
  rightLineCount: number;
};

export type AnchorLifecycleResult = {
  state: WorkspaceAnchorState;
  moved: number;
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
  return { anchor: cloneAnchor(item.anchor), reason: item.reason };
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
  const staleManualAnchors = (state.staleManualAnchors ?? []).map(cloneStaleAnchor);
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

  const addStale = (anchor: Anchor): void => {
    const key = anchorPairKey(anchor);
    if (stalePairKeys.has(key)) {
      return;
    }
    stalePairKeys.add(key);
    staleManualAnchors.push({ anchor: cloneAnchor(anchor), reason: staleReason });
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
      addStale(original);
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
      addStale(original);
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

  return {
    state: {
      manualAnchors: (validationDeferred
        ? activeCandidates
        : validation.valid
      ).map(cloneAnchor),
      staleManualAnchors,
      autoAnchor: state.autoAnchor ? cloneAnchor(state.autoAnchor) : null,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      pendingLeftLineNo,
      pendingRightLineNo,
      selectedAnchorKey,
    },
    moved,
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
  options: PaneSnapshotAnchorRebaseOptions = {},
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
  );
  return reconcileMappedAnchors(
    state,
    side,
    mappedAnchors,
    (lineNo) => {
      const result = transformTrackedLineWithPreparedChanges(
        lineNo,
        preparedChanges,
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
  const staleManualAnchors = (state.staleManualAnchors ?? []).map(cloneStaleAnchor);
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
      });
      staleAdded += 1;
    }
    if (selectedAnchorKey === manualAnchorKey(issue.anchor)) {
      selectedAnchorKey = null;
    }
  });

  return {
    state: {
      manualAnchors: validation.valid.map(cloneAnchor),
      staleManualAnchors,
      autoAnchor: state.autoAnchor ? cloneAnchor(state.autoAnchor) : null,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      pendingLeftLineNo: state.pendingLeftLineNo,
      pendingRightLineNo: state.pendingRightLineNo,
      selectedAnchorKey,
    },
    moved: 0,
    pendingCleared: false,
    staleAdded,
    validationDeferred: false,
    validationOrigins: [],
  };
}
