import { describe, expect, it } from "vitest";
import {
  applySideScopedAnchorTransition,
  beginVersionedStateChange,
  beginVersionedStateTransition,
  commitVersionedStateChange,
  createVersionedStateHistory,
  replaceCurrentVersionedState,
  resetVersionedStateHistory,
} from "./anchorEditHistory";

type State = {
  active: number[];
  stale: number[];
  pending: number | null;
};

function cloneState(state: State): State {
  return {
    active: [...state.active],
    stale: [...state.stale],
    pending: state.pending,
  };
}

type AnchorState = {
  manualAnchors: { leftLineNo: number; rightLineNo: number }[];
  staleManualAnchors: {
    anchor: { leftLineNo: number; rightLineNo: number };
    reason: string;
  }[];
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  selectedAnchorKey: string | null;
  autoAnchor: { leftLineNo: number; rightLineNo: number } | null;
  suppressedAutoAnchorKey: string | null;
};

function cloneAnchorState(state: AnchorState): AnchorState {
  return {
    manualAnchors: state.manualAnchors.map((anchor) => ({ ...anchor })),
    staleManualAnchors: state.staleManualAnchors.map((item) => ({
      anchor: { ...item.anchor },
      reason: item.reason,
    })),
    pendingLeftLineNo: state.pendingLeftLineNo,
    pendingRightLineNo: state.pendingRightLineNo,
    selectedAnchorKey: state.selectedAnchorKey,
    autoAnchor: state.autoAnchor ? { ...state.autoAnchor } : null,
    suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
  };
}

function anchorState(
  leftLineNo: number,
  rightLineNo: number,
  overrides: Partial<AnchorState> = {},
): AnchorState {
  return {
    manualAnchors: [{ leftLineNo, rightLineNo }],
    staleManualAnchors: [],
    pendingLeftLineNo: null,
    pendingRightLineNo: null,
    selectedAnchorKey: `manual:${leftLineNo}:${rightLineNo}`,
    autoAnchor: { leftLineNo: 0, rightLineNo: 0 },
    suppressedAutoAnchorKey: "auto:0:0",
    ...overrides,
  };
}

describe("versioned anchor edit history", () => {
  it("restores active/stale anchors after an aborted deferred edit is undone and redone", () => {
    const before = anchorState(2, 2);
    const provisional = anchorState(3, 2);
    const settled = anchorState(2, 2, {
      manualAnchors: [],
      staleManualAnchors: [{
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "edit-unresolved",
      }],
      selectedAnchorKey: null,
    });
    const history = createVersionedStateHistory(100, before, cloneAnchorState);

    beginVersionedStateChange(
      history,
      { versionId: 101, isUndoing: false, isRedoing: false },
      before,
    );
    commitVersionedStateChange(history, provisional);
    replaceCurrentVersionedState(history, settled);

    const undo = beginVersionedStateTransition(
      history,
      { versionId: 100, isUndoing: true, isRedoing: false },
      settled,
    );
    const undone = applySideScopedAnchorTransition(settled, "left", undo!).state;
    expect(undone.manualAnchors).toEqual(before.manualAnchors);
    expect(undone.staleManualAnchors).toEqual([]);
    commitVersionedStateChange(history, undone);

    const redo = beginVersionedStateTransition(
      history,
      { versionId: 101, isUndoing: false, isRedoing: true },
      undone,
    );
    const redone = applySideScopedAnchorTransition(undone, "left", redo!).state;
    expect(redone.manualAnchors).toEqual([]);
    expect(redone.staleManualAnchors).toEqual(settled.staleManualAnchors);
  });

  it("restores the before/after anchor state across undo and redo", () => {
    const before: State = { active: [2], stale: [], pending: 4 };
    const after: State = { active: [], stale: [2], pending: null };
    const history = createVersionedStateHistory(10, before, cloneState);

    expect(
      beginVersionedStateChange(
        history,
        { versionId: 11, isUndoing: false, isRedoing: false },
        before,
      ),
    ).toBeNull();
    commitVersionedStateChange(history, after);

    expect(
      beginVersionedStateChange(
        history,
        { versionId: 10, isUndoing: true, isRedoing: false },
        after,
      ),
    ).toEqual(before);
    commitVersionedStateChange(history, before);

    expect(
      beginVersionedStateChange(
        history,
        { versionId: 11, isUndoing: false, isRedoing: true },
        before,
      ),
    ).toEqual(after);
  });

  it("supports undoing more than one edit", () => {
    const initial: State = { active: [2], stale: [], pending: null };
    const first: State = { active: [3], stale: [], pending: null };
    const second: State = { active: [5], stale: [], pending: null };
    const history = createVersionedStateHistory(20, initial, cloneState);

    beginVersionedStateChange(
      history,
      { versionId: 21, isUndoing: false, isRedoing: false },
      initial,
    );
    commitVersionedStateChange(history, first);
    beginVersionedStateChange(
      history,
      { versionId: 22, isUndoing: false, isRedoing: false },
      first,
    );
    commitVersionedStateChange(history, second);

    expect(
      beginVersionedStateChange(
        history,
        { versionId: 21, isUndoing: true, isRedoing: false },
        second,
      ),
    ).toEqual(first);
    commitVersionedStateChange(history, first);
    expect(
      beginVersionedStateChange(
        history,
        { versionId: 20, isUndoing: true, isRedoing: false },
        first,
      ),
    ).toEqual(initial);
  });

  it("drops obsolete edit snapshots when a manual anchor action resets history", () => {
    const initial: State = { active: [2], stale: [], pending: null };
    const afterEdit: State = { active: [3], stale: [], pending: null };
    const afterManualAction: State = { active: [7], stale: [], pending: null };
    const history = createVersionedStateHistory(30, initial, cloneState);

    beginVersionedStateChange(
      history,
      { versionId: 31, isUndoing: false, isRedoing: false },
      initial,
    );
    commitVersionedStateChange(history, afterEdit);
    resetVersionedStateHistory(history, 31, afterManualAction);

    expect(
      beginVersionedStateChange(
        history,
        { versionId: 30, isUndoing: true, isRedoing: false },
        afterManualAction,
      ),
    ).toBeNull();
  });

  it("clones stored and restored states", () => {
    const initial: State = { active: [2], stale: [], pending: null };
    const history = createVersionedStateHistory(40, initial, cloneState);
    initial.active[0] = 99;

    const restored = beginVersionedStateChange(
      history,
      { versionId: 40, isUndoing: true, isRedoing: false },
      initial,
    );
    expect(restored).toEqual({ active: [2], stale: [], pending: null });
    restored?.active.push(8);

    expect(
      beginVersionedStateChange(
        history,
        { versionId: 40, isUndoing: false, isRedoing: true },
        initial,
      ),
    ).toEqual({ active: [2], stale: [], pending: null });
  });

  it("returns the exact edge snapshots for undo and redo", () => {
    const before: State = { active: [2], stale: [], pending: null };
    const after: State = { active: [3], stale: [], pending: null };
    const history = createVersionedStateHistory(50, before, cloneState);

    beginVersionedStateTransition(
      history,
      { versionId: 51, isUndoing: false, isRedoing: false },
      before,
    );
    commitVersionedStateChange(history, after);

    expect(
      beginVersionedStateTransition(
        history,
        { versionId: 50, isUndoing: true, isRedoing: false },
        after,
      ),
    ).toEqual({ from: after, to: before });
    commitVersionedStateChange(history, before);
    expect(
      beginVersionedStateTransition(
        history,
        { versionId: 51, isUndoing: false, isRedoing: true },
        before,
      ),
    ).toEqual({ from: before, to: after });
  });

  it("drops the obsolete redo branch after editing an undone version", () => {
    const first: State = { active: [1], stale: [], pending: null };
    const second: State = { active: [2], stale: [], pending: null };
    const third: State = { active: [3], stale: [], pending: null };
    const branched: State = { active: [4], stale: [], pending: null };
    const history = createVersionedStateHistory(60, first, cloneState);

    beginVersionedStateTransition(
      history,
      { versionId: 61, isUndoing: false, isRedoing: false },
      first,
    );
    commitVersionedStateChange(history, second);
    beginVersionedStateTransition(
      history,
      { versionId: 62, isUndoing: false, isRedoing: false },
      second,
    );
    commitVersionedStateChange(history, third);
    beginVersionedStateTransition(
      history,
      { versionId: 61, isUndoing: true, isRedoing: false },
      third,
    );
    commitVersionedStateChange(history, second);

    beginVersionedStateTransition(
      history,
      { versionId: 63, isUndoing: false, isRedoing: false },
      second,
    );
    commitVersionedStateChange(history, branched);

    expect(history.versionOrder).toEqual([60, 61, 63]);
    expect(history.snapshots.has(62)).toBe(false);
    expect(
      beginVersionedStateTransition(
        history,
        { versionId: 62, isUndoing: false, isRedoing: true },
        branched,
      ),
    ).toBeNull();
  });

  it("bounds retained snapshots and transitions during long editing", () => {
    let state: State = { active: [0], stale: [], pending: null };
    const history = createVersionedStateHistory(70, state, cloneState, {
      maxSnapshots: 3,
    });
    for (let offset = 1; offset <= 6; offset += 1) {
      beginVersionedStateTransition(
        history,
        {
          versionId: 70 + offset,
          isUndoing: false,
          isRedoing: false,
        },
        state,
      );
      state = { active: [offset], stale: [], pending: null };
      commitVersionedStateChange(history, state);
    }

    expect(history.versionOrder).toEqual([74, 75, 76]);
    expect(history.snapshots.size).toBe(3);
    expect(history.transitions).toHaveLength(2);
    expect(
      beginVersionedStateTransition(
        history,
        { versionId: 73, isUndoing: true, isRedoing: false },
        state,
      ),
    ).toBeNull();
  });
});

describe("side-scoped anchor history restoration", () => {
  it("keeps the currently selected anchor selected across undo and redo", () => {
    const beforeEdit = anchorState(2, 2, {
      manualAnchors: [
        { leftLineNo: 2, rightLineNo: 2 },
        { leftLineNo: 4, rightLineNo: 4 },
      ],
      selectedAnchorKey: "manual:2:2",
    });
    const afterEdit = anchorState(3, 2, {
      manualAnchors: [
        { leftLineNo: 3, rightLineNo: 2 },
        { leftLineNo: 5, rightLineNo: 4 },
      ],
      selectedAnchorKey: "manual:3:2",
    });
    const liveWithSecondSelected = cloneAnchorState(afterEdit);
    liveWithSecondSelected.selectedAnchorKey = "manual:5:4";

    const undone = applySideScopedAnchorTransition(
      liveWithSecondSelected,
      "left",
      { from: afterEdit, to: beforeEdit },
    );

    expect(undone.state.manualAnchors).toEqual(beforeEdit.manualAnchors);
    expect(undone.state.selectedAnchorKey).toBe("manual:4:4");

    const redone = applySideScopedAnchorTransition(
      undone.state,
      "left",
      { from: beforeEdit, to: afterEdit },
    );

    expect(redone.state.manualAnchors).toEqual(afterEdit.manualAnchors);
    expect(redone.state.selectedAnchorKey).toBe("manual:5:4");
  });

  it("undoes only the left coordinate after alternating left and right edits", () => {
    const before = anchorState(2, 2, {
      pendingLeftLineNo: 5,
      pendingRightLineNo: 7,
    });
    const afterLeftEdit = anchorState(3, 2, {
      pendingLeftLineNo: 6,
      pendingRightLineNo: 7,
    });
    const history = createVersionedStateHistory(
      80,
      before,
      cloneAnchorState,
    );
    beginVersionedStateTransition(
      history,
      { versionId: 81, isUndoing: false, isRedoing: false },
      before,
    );
    commitVersionedStateChange(history, afterLeftEdit);

    const liveAfterRightEdit = anchorState(3, 3, {
      pendingLeftLineNo: 6,
      pendingRightLineNo: 8,
      autoAnchor: { leftLineNo: 9, rightLineNo: 9 },
      suppressedAutoAnchorKey: "auto:9:9",
    });
    const undo = beginVersionedStateTransition(
      history,
      { versionId: 80, isUndoing: true, isRedoing: false },
      liveAfterRightEdit,
    );
    expect(undo).not.toBeNull();
    const restored = applySideScopedAnchorTransition(
      liveAfterRightEdit,
      "left",
      undo!,
    );

    expect(restored.state).toMatchObject({
      manualAnchors: [{ leftLineNo: 2, rightLineNo: 3 }],
      pendingLeftLineNo: 5,
      pendingRightLineNo: 8,
      selectedAnchorKey: "manual:2:3",
      autoAnchor: { leftLineNo: 9, rightLineNo: 9 },
      suppressedAutoAnchorKey: "auto:9:9",
    });
    expect(restored).toMatchObject({ restoredAnchors: 1, skippedAnchors: 0 });

    commitVersionedStateChange(history, restored.state);
    const redo = beginVersionedStateTransition(
      history,
      { versionId: 81, isUndoing: false, isRedoing: true },
      restored.state,
    );
    expect(redo).not.toBeNull();
    expect(
      applySideScopedAnchorTransition(restored.state, "left", redo!).state,
    ).toMatchObject({
      manualAnchors: [{ leftLineNo: 3, rightLineNo: 3 }],
      pendingLeftLineNo: 6,
      pendingRightLineNo: 8,
      selectedAnchorKey: "manual:3:3",
    });
  });

  it("restores an unambiguous active-to-stale transition and its selection", () => {
    const active = anchorState(4, 6);
    const stale = anchorState(4, 6, {
      manualAnchors: [],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
      pendingLeftLineNo: null,
      selectedAnchorKey: null,
    });

    const undo = applySideScopedAnchorTransition(stale, "left", {
      from: stale,
      to: active,
    });
    expect(undo.state.manualAnchors).toEqual([
      { leftLineNo: 4, rightLineNo: 6 },
    ]);
    expect(undo.state.staleManualAnchors).toEqual([]);
    expect(undo.state.selectedAnchorKey).toBe("manual:4:6");

    const redo = applySideScopedAnchorTransition(undo.state, "left", {
      from: active,
      to: stale,
    });
    expect(redo.state.manualAnchors).toEqual([]);
    expect(redo.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 4, rightLineNo: 6 },
        reason: "edit-unresolved",
      },
    ]);
    expect(redo.state.selectedAnchorKey).toBeNull();
  });

  it("keeps an anchor stale when an opposite-side edit makes reactivation unsafe", () => {
    const active = anchorState(4, 6);
    const stale = anchorState(4, 6, {
      manualAnchors: [],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
      selectedAnchorKey: null,
    });

    const restored = applySideScopedAnchorTransition(
      stale,
      "left",
      { from: stale, to: active },
      { allowStaleReactivation: false },
    );

    expect(restored.state.manualAnchors).toEqual([]);
    expect(restored.state.staleManualAnchors).toEqual(
      stale.staleManualAnchors,
    );
    expect(restored.restoredAnchors).toBe(0);
    expect(restored.skippedAnchors).toBeGreaterThan(0);
  });

  it("still deactivates an active anchor when stale reactivation is disabled", () => {
    const active = anchorState(4, 6);
    const stale = anchorState(4, 6, {
      manualAnchors: [],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
      selectedAnchorKey: null,
    });

    const restored = applySideScopedAnchorTransition(
      active,
      "left",
      { from: active, to: stale },
      { allowStaleReactivation: false },
    );

    expect(restored.state.manualAnchors).toEqual([]);
    expect(restored.state.staleManualAnchors).toEqual(
      stale.staleManualAnchors,
    );
  });

  it("keeps live anchors when their identity is ambiguous", () => {
    const transitionFrom = anchorState(3, 2);
    const transitionTo = anchorState(2, 2);
    const ambiguousLive = anchorState(3, 3, {
      manualAnchors: [
        { leftLineNo: 3, rightLineNo: 3 },
        { leftLineNo: 3, rightLineNo: 7 },
      ],
      selectedAnchorKey: "manual:3:3",
    });

    const restored = applySideScopedAnchorTransition(ambiguousLive, "left", {
      from: transitionFrom,
      to: transitionTo,
    });
    expect(restored.state.manualAnchors).toEqual(
      ambiguousLive.manualAnchors,
    );
    expect(restored.state.selectedAnchorKey).toBe("manual:3:3");
    expect(restored.restoredAnchors).toBe(0);
    expect(restored.skippedAnchors).toBe(1);
  });

  it("keeps the live selection when its coordinate move would conflict", () => {
    const transitionFrom = anchorState(2, 2);
    const transitionTo = anchorState(3, 2);
    const live = anchorState(2, 2, {
      manualAnchors: [
        { leftLineNo: 2, rightLineNo: 2 },
        { leftLineNo: 3, rightLineNo: 4 },
      ],
      selectedAnchorKey: "manual:2:2",
    });

    const restored = applySideScopedAnchorTransition(live, "left", {
      from: transitionFrom,
      to: transitionTo,
    });

    expect(restored.state.manualAnchors).toEqual(live.manualAnchors);
    expect(restored.state.selectedAnchorKey).toBe("manual:2:2");
    expect(restored.restoredAnchors).toBe(0);
    expect(restored.skippedAnchors).toBe(1);
  });

  it("allows an active anchor to share a pair with a historical stale anchor", () => {
    const transitionFrom = anchorState(3, 3);
    const transitionTo = anchorState(2, 3);
    const live = anchorState(3, 4, {
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 2, rightLineNo: 4 },
          reason: "edit-unresolved",
        },
      ],
      selectedAnchorKey: "manual:3:4",
    });

    const restored = applySideScopedAnchorTransition(live, "left", {
      from: transitionFrom,
      to: transitionTo,
    });
    expect(restored.state.manualAnchors).toEqual([
      { leftLineNo: 2, rightLineNo: 4 },
    ]);
    expect(restored.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 4 },
        reason: "edit-unresolved",
      },
    ]);
    expect(restored.state.selectedAnchorKey).toBe("manual:2:4");
    expect(restored).toMatchObject({ restoredAnchors: 1, skippedAnchors: 0 });
  });

  it("restores a coalesced active anchor on undo and removes it again on redo", () => {
    const expanded = anchorState(4, 6, {
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
    });
    const collapsed = anchorState(4, 6, {
      manualAnchors: [],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
      selectedAnchorKey: null,
    });
    const history = createVersionedStateHistory(
      90,
      expanded,
      cloneAnchorState,
    );
    beginVersionedStateTransition(
      history,
      { versionId: 91, isUndoing: false, isRedoing: false },
      expanded,
    );
    commitVersionedStateChange(history, collapsed);

    const undoTransition = beginVersionedStateTransition(
      history,
      { versionId: 90, isUndoing: true, isRedoing: false },
      collapsed,
    );
    expect(undoTransition).not.toBeNull();
    const undone = applySideScopedAnchorTransition(
      collapsed,
      "left",
      undoTransition!,
      { allowStaleReactivation: true },
    );
    expect(undone.state.manualAnchors).toEqual([
      { leftLineNo: 4, rightLineNo: 6 },
    ]);
    expect(undone.state.staleManualAnchors).toEqual(
      expanded.staleManualAnchors,
    );
    expect(undone.state.selectedAnchorKey).toBe("manual:4:6");
    expect(undone).toMatchObject({ restoredAnchors: 1, skippedAnchors: 0 });

    commitVersionedStateChange(history, undone.state);
    const redoTransition = beginVersionedStateTransition(
      history,
      { versionId: 91, isUndoing: false, isRedoing: true },
      undone.state,
    );
    expect(redoTransition).not.toBeNull();
    const redone = applySideScopedAnchorTransition(
      undone.state,
      "left",
      redoTransition!,
      { allowStaleReactivation: true },
    );
    expect(redone.state.manualAnchors).toEqual([]);
    expect(redone.state.staleManualAnchors).toEqual(
      collapsed.staleManualAnchors,
    );
    expect(redone.state.selectedAnchorKey).toBeNull();
    expect(redone).toMatchObject({ restoredAnchors: 1, skippedAnchors: 0 });
  });

  it("still collapses a coalesced active anchor after its opposite side moved", () => {
    const expanded = anchorState(4, 6, {
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
    });
    const collapsed = anchorState(4, 6, {
      manualAnchors: [],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
      selectedAnchorKey: null,
    });
    const liveAfterOppositeEdit = anchorState(4, 8, {
      staleManualAnchors: expanded.staleManualAnchors,
      selectedAnchorKey: "manual:4:8",
    });

    const result = applySideScopedAnchorTransition(
      liveAfterOppositeEdit,
      "left",
      { from: expanded, to: collapsed },
      { allowStaleReactivation: false },
    );

    expect(result.state.manualAnchors).toEqual([]);
    expect(result.state.staleManualAnchors).toEqual(
      collapsed.staleManualAnchors,
    );
    expect(result.state.selectedAnchorKey).toBeNull();
    expect(result).toMatchObject({ restoredAnchors: 1, skippedAnchors: 0 });
  });

  it("does not recreate a coalesced active anchor without unique proof", () => {
    const expanded = anchorState(4, 6, {
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
    });
    const collapsed = anchorState(4, 6, {
      manualAnchors: [],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 4, rightLineNo: 6 },
          reason: "edit-unresolved",
        },
      ],
      selectedAnchorKey: null,
    });

    const oppositeSideChanged = applySideScopedAnchorTransition(
      collapsed,
      "left",
      { from: collapsed, to: expanded },
      { allowStaleReactivation: false },
    );
    expect(oppositeSideChanged.state.manualAnchors).toEqual([]);
    expect(oppositeSideChanged.state.staleManualAnchors).toEqual(
      collapsed.staleManualAnchors,
    );

    const ambiguousLive = cloneAnchorState(collapsed);
    ambiguousLive.staleManualAnchors.push({
      anchor: { leftLineNo: 4, rightLineNo: 6 },
      reason: "edit-unresolved",
    });
    const ambiguous = applySideScopedAnchorTransition(
      ambiguousLive,
      "left",
      { from: collapsed, to: expanded },
      { allowStaleReactivation: true },
    );
    expect(ambiguous.state.manualAnchors).toEqual([]);
    expect(ambiguous.state.staleManualAnchors).toEqual(
      ambiguousLive.staleManualAnchors,
    );
    expect(ambiguous.restoredAnchors).toBe(0);
    expect(ambiguous.skippedAnchors).toBeGreaterThan(0);
  });
});
