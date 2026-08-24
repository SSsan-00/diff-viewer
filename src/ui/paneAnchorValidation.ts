import type { WorkspaceAnchorState } from "../storage/workspaces";
import {
  finalizeDeferredAnchorValidation,
  rebasePaneSnapshotAnchorLifecycleResult,
  type AnchorLifecycleResult,
  type AnchorLineCounts,
  type DeferredAnchorValidationOrigin,
} from "./anchorLifecycle";
import type { AnchorSide } from "./anchorTracking";

export type PaneSnapshotAnchorSource = "load" | "reload";

export type PaneSnapshotPendingState = Readonly<Record<AnchorSide, boolean>>;

export type PaneAnchorValidationCoordinator = Readonly<{
  validationDeferred: boolean;
  validationOrigins: readonly DeferredAnchorValidationOrigin[];
  source: PaneSnapshotAnchorSource | null;
}>;

export function createPaneAnchorValidationCoordinator(): PaneAnchorValidationCoordinator {
  return { validationDeferred: false, validationOrigins: [], source: null };
}

export function shouldInterruptPaneSnapshotForPersistence(
  coordinator: PaneAnchorValidationCoordinator,
  forceAnchorSettlement: boolean,
): boolean {
  return forceAnchorSettlement || coordinator.validationDeferred;
}

function oppositeSide(side: AnchorSide): AnchorSide {
  return side === "left" ? "right" : "left";
}

export function commitPaneSnapshotAnchorTransition(options: {
  coordinator: PaneAnchorValidationCoordinator;
  currentState: WorkspaceAnchorState;
  lineCounts: AnchorLineCounts;
  pending: PaneSnapshotPendingState;
  prepared: AnchorLifecycleResult;
  side: AnchorSide;
  source: PaneSnapshotAnchorSource;
}): {
  coordinator: PaneAnchorValidationCoordinator;
  result: AnchorLifecycleResult;
} {
  const result = rebasePaneSnapshotAnchorLifecycleResult(
    options.prepared,
    options.currentState,
    options.lineCounts,
    {
      deferValidation: options.pending[oppositeSide(options.side)],
      validationOrigins: options.coordinator.validationOrigins,
    },
  );
  return {
    coordinator: recordDeferredAnchorValidationResult(
      options.coordinator,
      result,
      options.source,
    ),
    result,
  };
}

export function recordDeferredAnchorValidationResult(
  coordinator: PaneAnchorValidationCoordinator,
  result: AnchorLifecycleResult,
  source: PaneSnapshotAnchorSource,
): PaneAnchorValidationCoordinator {
  const validationDeferred =
    coordinator.validationDeferred || result.validationDeferred;
  return {
    validationDeferred,
    validationOrigins: result.validationOrigins.length > 0
      ? result.validationOrigins
      : coordinator.validationOrigins,
    source: result.validationDeferred
      ? coordinator.source ?? source
      : coordinator.source,
  };
}

export function settlePaneSnapshotAnchorOperation(options: {
  coordinator: PaneAnchorValidationCoordinator;
  currentState: WorkspaceAnchorState;
  lineCounts: AnchorLineCounts;
  pending: PaneSnapshotPendingState;
}): {
  coordinator: PaneAnchorValidationCoordinator;
  result: AnchorLifecycleResult | null;
  source: PaneSnapshotAnchorSource | null;
} {
  if (options.pending.left || options.pending.right) {
    return {
      coordinator: options.coordinator,
      result: null,
      source: null,
    };
  }
  if (!options.coordinator.validationDeferred) {
    return {
      coordinator: createPaneAnchorValidationCoordinator(),
      result: null,
      source: null,
    };
  }

  return {
    coordinator: createPaneAnchorValidationCoordinator(),
    result: finalizeDeferredAnchorValidation(
      options.currentState,
      options.lineCounts,
      options.coordinator.validationOrigins,
    ),
    source: options.coordinator.source,
  };
}
