import { describe, expect, it } from "vitest";
import { buildDecodedFiles } from "../file/decodedFiles";
import type { WorkspaceAnchorState } from "../storage/workspaces";
import {
  updateAnchorStateForContentChanges,
  updateAnchorStateForPaneReload,
} from "./anchorLifecycle";
import {
  commitPaneSnapshotAnchorTransition,
  createPaneAnchorValidationCoordinator,
  recordDeferredAnchorValidationResult,
  settlePaneSnapshotAnchorOperation,
  shouldInterruptPaneSnapshotForPersistence,
} from "./paneAnchorValidation";

function snapshot(text: string) {
  return buildDecodedFiles(
    [{ name: "pane.txt", bytes: new TextEncoder().encode(text) }],
    "utf-8",
  );
}

function initialState(): WorkspaceAnchorState {
  return {
    manualAnchors: [
      { leftLineNo: 1, rightLineNo: 1 },
      { leftLineNo: 2, rightLineNo: 2 },
    ],
    staleManualAnchors: [
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "edit-unresolved",
      },
    ],
    autoAnchor: null,
    suppressedAutoAnchorKey: null,
    pendingLeftLineNo: 1,
    pendingRightLineNo: 1,
    selectedAnchorKey: "manual:1:1",
  };
}

function prepareConcurrentSwaps(state: WorkspaceAnchorState) {
  const previous = snapshot("head\nfirst\nsecond\ntail");
  const swapped = snapshot("head\nsecond\nfirst\ntail");
  const lineCounts = { leftLineCount: 4, rightLineCount: 4 };
  return {
    lineCounts,
    left: updateAnchorStateForPaneReload(
      state,
      "left",
      previous,
      swapped,
      lineCounts,
    ),
    right: updateAnchorStateForPaneReload(
      state,
      "right",
      previous,
      swapped,
      lineCounts,
    ),
  };
}

describe("pane anchor validation coordinator", () => {
  it("keeps an origins-only valid batch during automatic persistence", () => {
    const coordinator = {
      ...createPaneAnchorValidationCoordinator(),
      validationOrigins: [{
        anchor: { leftLineNo: 2, rightLineNo: 3 },
        original: { leftLineNo: 2, rightLineNo: 2 },
      }],
    };

    expect(
      shouldInterruptPaneSnapshotForPersistence(coordinator, false),
    ).toBe(false);
    expect(
      shouldInterruptPaneSnapshotForPersistence(coordinator, true),
    ).toBe(true);
    expect(
      shouldInterruptPaneSnapshotForPersistence(
        { ...coordinator, validationDeferred: true },
        false,
      ),
    ).toBe(true);
  });

  it.each([
    ["left then right", ["left", "right"] as const],
    ["right then left", ["right", "left"] as const],
  ])("clears safe transition origins after both panes become idle: %s", (_label, order) => {
    const previous = snapshot("head\nfirst\nsecond\ntail");
    const shifted = snapshot("inserted\nhead\nfirst\nsecond\ntail");
    let current = initialState();
    const prepared = {
      left: updateAnchorStateForPaneReload(
        current,
        "left",
        previous,
        shifted,
        { leftLineCount: 5, rightLineCount: 4 },
      ),
      right: updateAnchorStateForPaneReload(
        current,
        "right",
        previous,
        shifted,
        { leftLineCount: 4, rightLineCount: 5 },
      ),
    };
    let coordinator = createPaneAnchorValidationCoordinator();
    const pending = { left: true, right: true };

    order.forEach((side) => {
      const committed = commitPaneSnapshotAnchorTransition({
        coordinator,
        currentState: current,
        lineCounts: { leftLineCount: 5, rightLineCount: 5 },
        pending,
        prepared: prepared[side],
        side,
        source: "reload",
      });
      coordinator = committed.coordinator;
      current = committed.result.state;
      pending[side] = false;
      coordinator = settlePaneSnapshotAnchorOperation({
        coordinator,
        currentState: current,
        lineCounts: { leftLineCount: 5, rightLineCount: 5 },
        pending,
      }).coordinator;
    });

    expect(current.manualAnchors).toEqual([
      { leftLineNo: 2, rightLineNo: 2 },
      { leftLineNo: 3, rightLineNo: 3 },
    ]);
    expect(coordinator).toEqual(createPaneAnchorValidationCoordinator());
  });

  it.each([
    ["left then right", ["left", "right"] as const],
    ["right then left", ["right", "left"] as const],
  ])("keeps both provable anchors across concurrent swaps: %s", (_label, order) => {
    let current = initialState();
    const prepared = prepareConcurrentSwaps(current);
    let coordinator = createPaneAnchorValidationCoordinator();
    const pending = { left: true, right: true };

    order.forEach((side) => {
      const committed = commitPaneSnapshotAnchorTransition({
        coordinator,
        currentState: current,
        lineCounts: prepared.lineCounts,
        pending,
        prepared: prepared[side],
        side,
        source: "reload",
      });
      coordinator = committed.coordinator;
      current = committed.result.state;

      pending[side] = false;
      const settled = settlePaneSnapshotAnchorOperation({
        coordinator,
        currentState: current,
        lineCounts: prepared.lineCounts,
        pending,
      });
      coordinator = settled.coordinator;
      if (settled.result) {
        current = settled.result.state;
      }
    });

    expect(coordinator.validationDeferred).toBe(false);
    expect(current.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 1 },
      { leftLineNo: 2, rightLineNo: 2 },
    ]);
    expect(current.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "edit-unresolved",
      },
    ]);
    expect(current.pendingLeftLineNo).toBe(2);
    expect(current.pendingRightLineNo).toBe(2);
    expect(current.selectedAnchorKey).toBe("manual:2:2");
  });

  it("finalizes deferred invalid anchors when the opposite operation aborts", () => {
    let current = initialState();
    const prepared = prepareConcurrentSwaps(current);
    let coordinator = createPaneAnchorValidationCoordinator();
    const pending = { left: true, right: true };

    const committed = commitPaneSnapshotAnchorTransition({
      coordinator,
      currentState: current,
      lineCounts: prepared.lineCounts,
      pending,
      prepared: prepared.left,
      side: "left",
      source: "reload",
    });
    coordinator = committed.coordinator;
    current = committed.result.state;
    pending.left = false;
    expect(
      settlePaneSnapshotAnchorOperation({
        coordinator,
        currentState: current,
        lineCounts: prepared.lineCounts,
        pending,
      }).result,
    ).toBeNull();

    pending.right = false;
    const settled = settlePaneSnapshotAnchorOperation({
      coordinator,
      currentState: current,
      lineCounts: prepared.lineCounts,
      pending,
    });

    expect(settled.source).toBe("reload");
    expect(settled.result?.state.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 2 },
    ]);
    expect(settled.result?.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "edit-unresolved",
      },
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        reason: "reload-unresolved",
      },
    ]);
    expect(settled.result?.state.selectedAnchorKey).toBeNull();
    expect(settled.coordinator.validationDeferred).toBe(false);
  });

  it("keeps immediate validation for a standalone pane reload", () => {
    const current = initialState();
    const prepared = prepareConcurrentSwaps(current);
    const committed = commitPaneSnapshotAnchorTransition({
      coordinator: createPaneAnchorValidationCoordinator(),
      currentState: current,
      lineCounts: prepared.lineCounts,
      pending: { left: true, right: false },
      prepared: prepared.left,
      side: "left",
      source: "reload",
    });

    expect(committed.result.validationDeferred).toBe(false);
    expect(committed.result.state.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 2 },
    ]);
    expect(committed.coordinator.validationDeferred).toBe(false);
  });

  it("clears safe concurrent origins at idle before a later independent operation", () => {
    const previous = snapshot("head\nfirst\ntarget\ntail");
    const shifted = snapshot("inserted\nhead\nfirst\ntarget\ntail");
    const withoutTarget = snapshot("head\nfirst\nchanged\ntail");
    const initial: WorkspaceAnchorState = {
      ...initialState(),
      manualAnchors: [{ leftLineNo: 2, rightLineNo: 2 }],
      staleManualAnchors: [],
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: "manual:2:2",
    };
    const prepared = {
      left: updateAnchorStateForPaneReload(
        initial,
        "left",
        previous,
        withoutTarget,
        { leftLineCount: 4, rightLineCount: 4 },
      ),
      right: updateAnchorStateForPaneReload(
        initial,
        "right",
        previous,
        shifted,
        { leftLineCount: 4, rightLineCount: 5 },
      ),
    };
    let coordinator = createPaneAnchorValidationCoordinator();
    let current = initial;
    const pending = { left: true, right: true };

    const shiftedCommit = commitPaneSnapshotAnchorTransition({
      coordinator,
      currentState: current,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending,
      prepared: prepared.right,
      side: "right",
      source: "reload",
    });
    coordinator = shiftedCommit.coordinator;
    current = shiftedCommit.result.state;
    expect(coordinator.validationDeferred).toBe(false);
    expect(coordinator.validationOrigins).toHaveLength(1);
    pending.right = false;
    coordinator = settlePaneSnapshotAnchorOperation({
      coordinator,
      currentState: current,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending,
    }).coordinator;

    const unresolvedCommit = commitPaneSnapshotAnchorTransition({
      coordinator,
      currentState: current,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending,
      prepared: prepared.left,
      side: "left",
      source: "reload",
    });
    coordinator = unresolvedCommit.coordinator;
    current = unresolvedCommit.result.state;
    pending.left = false;
    coordinator = settlePaneSnapshotAnchorOperation({
      coordinator,
      currentState: current,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending,
    }).coordinator;
    expect(current.staleManualAnchors[0]?.anchor).toEqual({
      leftLineNo: 2,
      rightLineNo: 2,
    });
    expect(coordinator).toEqual(createPaneAnchorValidationCoordinator());

    const laterState: WorkspaceAnchorState = {
      ...initial,
      manualAnchors: [{ leftLineNo: 2, rightLineNo: 3 }],
      staleManualAnchors: [],
      selectedAnchorKey: "manual:2:3",
    };
    const laterPrepared = updateAnchorStateForPaneReload(
      laterState,
      "left",
      previous,
      withoutTarget,
      { leftLineCount: 4, rightLineCount: 5 },
    );
    const later = commitPaneSnapshotAnchorTransition({
      coordinator,
      currentState: laterState,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending: { left: true, right: false },
      prepared: laterPrepared,
      side: "left",
      source: "reload",
    });
    expect(later.result.state.staleManualAnchors[0]?.anchor).toEqual({
      leftLineNo: 2,
      rightLineNo: 3,
    });
  });

  it.each([
    ["opposite succeeds", true],
    ["opposite aborts", false],
  ])(
    "keeps deferred identities across an intervening normal edit when the %s",
    (_label, oppositeSucceeds) => {
      let current = initialState();
      const prepared = prepareConcurrentSwaps(current);
      let coordinator = createPaneAnchorValidationCoordinator();
      const pending = { left: true, right: true };
      const first = commitPaneSnapshotAnchorTransition({
        coordinator,
        currentState: current,
        lineCounts: prepared.lineCounts,
        pending,
        prepared: prepared.left,
        side: "left",
        source: "reload",
      });
      coordinator = first.coordinator;
      current = first.result.state;
      pending.left = false;

      const edited = updateAnchorStateForContentChanges(
        current,
        "left",
        [
          {
            range: {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 1,
            },
            text: "inserted\n",
          },
        ],
        { leftLineCount: 5, rightLineCount: 4 },
        {
          deferValidation: coordinator.validationDeferred,
          validationOrigins: coordinator.validationOrigins,
        },
      );
      coordinator = recordDeferredAnchorValidationResult(
        coordinator,
        edited,
        "reload",
      );
      current = edited.state;
      expect(current.manualAnchors).toHaveLength(2);

      if (oppositeSucceeds) {
        const second = commitPaneSnapshotAnchorTransition({
          coordinator,
          currentState: current,
          lineCounts: { leftLineCount: 5, rightLineCount: 4 },
          pending,
          prepared: prepared.right,
          side: "right",
          source: "reload",
        });
        coordinator = second.coordinator;
        current = second.result.state;
      }

      pending.right = false;
      const settled = settlePaneSnapshotAnchorOperation({
        coordinator,
        currentState: current,
        lineCounts: { leftLineCount: 5, rightLineCount: 4 },
        pending,
      });
      current = settled.result?.state ?? current;

      if (oppositeSucceeds) {
        expect(current.manualAnchors).toEqual([
          { leftLineNo: 2, rightLineNo: 1 },
          { leftLineNo: 3, rightLineNo: 2 },
        ]);
        expect(current.selectedAnchorKey).toBe("manual:3:2");
      } else {
        expect(current.manualAnchors).toEqual([
          { leftLineNo: 2, rightLineNo: 2 },
        ]);
        expect(current.staleManualAnchors).toEqual([
          {
            anchor: { leftLineNo: 2, rightLineNo: 2 },
            reason: "edit-unresolved",
          },
          {
            anchor: { leftLineNo: 1, rightLineNo: 1 },
            reason: "reload-unresolved",
          },
        ]);
        expect(current.selectedAnchorKey).toBeNull();
      }
    },
  );

  it("keeps the prepare origin canonical when undo aborts a coordinated batch", () => {
    let current = initialState();
    const prepared = prepareConcurrentSwaps(current);
    let coordinator = createPaneAnchorValidationCoordinator();
    const first = commitPaneSnapshotAnchorTransition({
      coordinator,
      currentState: current,
      lineCounts: prepared.lineCounts,
      pending: { left: true, right: true },
      prepared: prepared.left,
      side: "left",
      source: "reload",
    });
    coordinator = first.coordinator;
    current = first.result.state;

    const inserted = updateAnchorStateForContentChanges(
      current,
      "left",
      [{
        range: {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
        text: "inserted\n",
      }],
      { leftLineCount: 5, rightLineCount: 4 },
      {
        deferValidation: true,
        validationOrigins: coordinator.validationOrigins,
      },
    );
    coordinator = recordDeferredAnchorValidationResult(
      coordinator,
      inserted,
      "reload",
    );
    current = inserted.state;

    const aborted = settlePaneSnapshotAnchorOperation({
      coordinator,
      currentState: current,
      lineCounts: prepared.lineCounts,
      pending: { left: false, right: false },
    });

    expect(aborted.coordinator).toEqual(createPaneAnchorValidationCoordinator());
    expect(aborted.result?.state.staleManualAnchors).toContainEqual({
      anchor: { leftLineNo: 1, rightLineNo: 1 },
      reason: "reload-unresolved",
    });
  });

  it("does not reuse an old origin after a manual remove and add at the same pair", () => {
    const previous = snapshot("head\nfirst\ntarget\ntail");
    const shifted = snapshot("inserted\nhead\nfirst\ntarget\ntail");
    const initial: WorkspaceAnchorState = {
      ...initialState(),
      manualAnchors: [{ leftLineNo: 2, rightLineNo: 2 }],
      staleManualAnchors: [],
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: null,
    };
    const prepared = updateAnchorStateForPaneReload(
      initial,
      "right",
      previous,
      shifted,
      { leftLineCount: 4, rightLineCount: 5 },
    );
    const committed = commitPaneSnapshotAnchorTransition({
      coordinator: createPaneAnchorValidationCoordinator(),
      currentState: initial,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending: { left: true, right: true },
      prepared,
      side: "right",
      source: "reload",
    });
    const boundary = settlePaneSnapshotAnchorOperation({
      coordinator: committed.coordinator,
      currentState: committed.result.state,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending: { left: false, right: false },
    });
    expect(boundary.coordinator.validationOrigins).toEqual([]);

    const replacement: WorkspaceAnchorState = {
      ...committed.result.state,
      manualAnchors: [{ leftLineNo: 2, rightLineNo: 3 }],
      staleManualAnchors: [],
    };
    const unresolved = updateAnchorStateForPaneReload(
      replacement,
      "left",
      previous,
      snapshot("head\nfirst\nchanged\ntail"),
      { leftLineCount: 4, rightLineCount: 5 },
    );
    const later = commitPaneSnapshotAnchorTransition({
      coordinator: boundary.coordinator,
      currentState: replacement,
      lineCounts: { leftLineCount: 4, rightLineCount: 5 },
      pending: { left: true, right: false },
      prepared: unresolved,
      side: "left",
      source: "reload",
    });
    expect(later.result.state.staleManualAnchors[0]?.anchor).toEqual({
      leftLineNo: 2,
      rightLineNo: 3,
    });
  });
});
