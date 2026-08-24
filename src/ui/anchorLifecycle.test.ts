import { describe, expect, it } from "vitest";
import { buildDecodedFiles } from "../file/decodedFiles";
import type { WorkspaceAnchorState } from "../storage/workspaces";
import {
  finalizeDeferredAnchorValidation,
  rebasePaneSnapshotAnchorLifecycleResult,
  updateAnchorStateForContentChanges,
  updateAnchorStateForPaneAppend,
  updateAnchorStateForPaneReload,
} from "./anchorLifecycle";
import {
  beginVersionedStateChange,
  commitVersionedStateChange,
  createVersionedStateHistory,
} from "./anchorEditHistory";
import { buildAnchorDecorations } from "./anchorDecorations";
import type { ContentChangeLike } from "./anchorTracking";

function state(overrides: Partial<WorkspaceAnchorState> = {}): WorkspaceAnchorState {
  return {
    manualAnchors: [{ leftLineNo: 2, rightLineNo: 2 }],
    staleManualAnchors: [],
    autoAnchor: null,
    suppressedAutoAnchorKey: null,
    pendingLeftLineNo: null,
    pendingRightLineNo: null,
    selectedAnchorKey: "manual:2:2",
    ...overrides,
  };
}

function change(
  startLineNumber: number,
  startColumn: number,
  endLineNumber: number,
  endColumn: number,
  text: string,
): ContentChangeLike {
  return {
    range: { startLineNumber, startColumn, endLineNumber, endColumn },
    text,
  };
}

function snapshot(files: readonly { name: string; text: string }[]) {
  return buildDecodedFiles(
    files.map((file) => ({
      name: file.name,
      bytes: new TextEncoder().encode(file.text),
    })),
    "utf-8",
  );
}

describe("updateAnchorStateForContentChanges", () => {
  it("moves active and pending lines on the edited side and refreshes selection", () => {
    const result = updateAnchorStateForContentChanges(
      state({ pendingLeftLineNo: 4 }),
      "left",
      [change(1, 1, 1, 1, "inserted\n")],
      { leftLineCount: 8, rightLineCount: 7 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 3, rightLineNo: 2 },
    ]);
    expect(result.state.pendingLeftLineNo).toBe(5);
    expect(result.state.selectedAnchorKey).toBe("manual:3:2");
    expect(result.staleAdded).toBe(0);

    const decorations = buildAnchorDecorations(
      result.state.manualAnchors,
      null,
      (line, startColumn, endColumn) => ({
        startLineNumber: line,
        startColumn,
        endLineNumber: line,
        endColumn,
      }),
    );
    expect(decorations.left[0]?.range.startLineNumber).toBe(4);
    expect(decorations.right[0]?.range.startLineNumber).toBe(3);
  });

  it("shares prepared change text between active anchors and the pending line", () => {
    let textReads = 0;
    const contentChange: ContentChangeLike = {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
      get text() {
        textReads += 1;
        return "large pasted line\n";
      },
    };

    const result = updateAnchorStateForContentChanges(
      state({
        manualAnchors: [
          { leftLineNo: 2, rightLineNo: 2 },
          { leftLineNo: 4, rightLineNo: 4 },
        ],
        pendingLeftLineNo: 3,
        selectedAnchorKey: null,
      }),
      "left",
      [contentChange],
      { leftLineCount: 8, rightLineCount: 7 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 3, rightLineNo: 2 },
      { leftLineNo: 5, rightLineNo: 4 },
    ]);
    expect(result.state.pendingLeftLineNo).toBe(4);
    expect(textReads).toBe(1);
  });

  it("deactivates an anchor whose logical line is removed", () => {
    const result = updateAnchorStateForContentChanges(
      state(),
      "left",
      [change(3, 1, 4, 1, "")],
      { leftLineCount: 4, rightLineCount: 5 },
    );

    expect(result.state.manualAnchors).toEqual([]);
    expect(result.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "edit-unresolved",
      },
    ]);
    expect(result.state.selectedAnchorKey).toBeNull();
    expect(result.staleAdded).toBe(1);
  });

  it("returns a shifted anchor to its original line through an inverse edit", () => {
    const shifted = updateAnchorStateForContentChanges(
      state(),
      "left",
      [change(1, 1, 1, 1, "inserted\n")],
      { leftLineCount: 6, rightLineCount: 5 },
    );
    const restored = updateAnchorStateForContentChanges(
      shifted.state,
      "left",
      [change(1, 1, 2, 1, "")],
      { leftLineCount: 5, rightLineCount: 5 },
    );

    expect(restored.state.manualAnchors).toEqual([
      { leftLineNo: 2, rightLineNo: 2 },
    ]);
    expect(restored.state.selectedAnchorKey).toBe("manual:2:2");
  });

  it("clears an auto-anchor selection because the auto anchor is recalculated", () => {
    const result = updateAnchorStateForContentChanges(
      state({ selectedAnchorKey: "auto:2:2" }),
      "left",
      [change(5, 2, 5, 2, "x")],
      { leftLineCount: 5, rightLineCount: 5 },
    );

    expect(result.state.selectedAnchorKey).toBeNull();
  });

  it("keeps an active anchor when it shifts onto historical stale coordinates", () => {
    const result = updateAnchorStateForContentChanges(
      state({
        manualAnchors: [{ leftLineNo: 1, rightLineNo: 2 }],
        staleManualAnchors: [
          {
            anchor: { leftLineNo: 2, rightLineNo: 2 },
            reason: "edit-unresolved",
          },
        ],
        selectedAnchorKey: "manual:1:2",
      }),
      "left",
      [change(1, 1, 1, 1, "inserted\n")],
      { leftLineCount: 5, rightLineCount: 5 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 2, rightLineNo: 2 },
    ]);
    expect(result.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "edit-unresolved",
      },
    ]);
    expect(result.state.selectedAnchorKey).toBe("manual:2:2");
    expect(result.staleAdded).toBe(0);
  });

  it("still deactivates true collisions between active anchors", () => {
    const result = updateAnchorStateForContentChanges(
      state({
        manualAnchors: [
          { leftLineNo: 1, rightLineNo: 1 },
          { leftLineNo: 1, rightLineNo: 2 },
        ],
        selectedAnchorKey: null,
      }),
      "left",
      [change(3, 2, 3, 2, "x")],
      { leftLineCount: 5, rightLineCount: 5 },
    );

    expect(result.state.manualAnchors).toEqual([]);
    expect(result.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        reason: "edit-unresolved",
      },
      {
        anchor: { leftLineNo: 1, rightLineNo: 2 },
        reason: "edit-unresolved",
      },
    ]);
  });

  it("restores an anchor made stale by deletion on undo and reapplies stale on redo", () => {
    const before = state({ pendingLeftLineNo: 2 });
    const history = createVersionedStateHistory(
      1,
      before,
      (value) => structuredClone(value),
    );
    beginVersionedStateChange(
      history,
      { versionId: 2, isUndoing: false, isRedoing: false },
      before,
    );
    const after = updateAnchorStateForContentChanges(
      before,
      "left",
      [change(3, 1, 4, 1, "")],
      { leftLineCount: 4, rightLineCount: 5 },
    ).state;
    commitVersionedStateChange(history, after);

    const undoState = beginVersionedStateChange(
      history,
      { versionId: 1, isUndoing: true, isRedoing: false },
      after,
    );
    expect(undoState).toEqual(before);
    commitVersionedStateChange(history, undoState ?? after);

    const redoState = beginVersionedStateChange(
      history,
      { versionId: 2, isUndoing: false, isRedoing: true },
      undoState ?? before,
    );
    expect(redoState).toEqual(after);
    expect(redoState?.manualAnchors).toEqual([]);
    expect(redoState?.staleManualAnchors).toHaveLength(1);
    expect(redoState?.pendingLeftLineNo).toBeNull();
  });
});

describe("updateAnchorStateForPaneReload", () => {
  it.each([
    ["left then right", ["left", "right"] as const],
    ["right then left", ["right", "left"] as const],
  ])(
    "defers intermediate pair-order validation until concurrent swaps are both applied: %s",
    (_label, commitOrder) => {
      const previous = snapshot([
        { name: "pane.txt", text: "head\nfirst\nsecond\ntail" },
      ]);
      const swapped = snapshot([
        { name: "pane.txt", text: "head\nsecond\nfirst\ntail" },
      ]);
      const initial = state({
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
        pendingLeftLineNo: 1,
        pendingRightLineNo: 1,
        selectedAnchorKey: "manual:1:1",
      });
      const prepared = {
        left: updateAnchorStateForPaneReload(
          initial,
          "left",
          previous,
          swapped,
          { leftLineCount: 4, rightLineCount: 4 },
        ),
        right: updateAnchorStateForPaneReload(
          initial,
          "right",
          previous,
          swapped,
          { leftLineCount: 4, rightLineCount: 4 },
        ),
      };

      let current = initial;
      let validationOrigins = prepared.left.validationOrigins;
      commitOrder.forEach((side, index) => {
        const committed = rebasePaneSnapshotAnchorLifecycleResult(
          prepared[side],
          current,
          { leftLineCount: 4, rightLineCount: 4 },
          { deferValidation: true, validationOrigins },
        );
        expect(committed.validationDeferred).toBe(index === 0);
        expect(committed.state.manualAnchors).toHaveLength(2);
        current = committed.state;
        if (committed.validationDeferred) {
          validationOrigins = committed.validationOrigins;
        }
      });
      const finalized = finalizeDeferredAnchorValidation(
        current,
        { leftLineCount: 4, rightLineCount: 4 },
        validationOrigins,
      );

      expect(finalized.validationDeferred).toBe(false);
      expect(finalized.staleAdded).toBe(0);
      expect(finalized.state.manualAnchors).toEqual([
        { leftLineNo: 1, rightLineNo: 1 },
        { leftLineNo: 2, rightLineNo: 2 },
      ]);
      expect(finalized.state.staleManualAnchors).toEqual([
        {
          anchor: { leftLineNo: 2, rightLineNo: 2 },
          reason: "edit-unresolved",
        },
      ]);
      expect(finalized.state.pendingLeftLineNo).toBe(2);
      expect(finalized.state.pendingRightLineNo).toBe(2);
      expect(finalized.state.selectedAnchorKey).toBe("manual:2:2");
    },
  );

  it("finalizes unresolved pair order after the opposite pane operation aborts", () => {
    const previous = snapshot([
      { name: "pane.txt", text: "head\nfirst\nsecond\ntail" },
    ]);
    const swapped = snapshot([
      { name: "pane.txt", text: "head\nsecond\nfirst\ntail" },
    ]);
    const initial = state({
      manualAnchors: [
        { leftLineNo: 1, rightLineNo: 1 },
        { leftLineNo: 2, rightLineNo: 2 },
      ],
      pendingLeftLineNo: 1,
      pendingRightLineNo: 1,
      selectedAnchorKey: "manual:1:1",
    });
    const prepared = updateAnchorStateForPaneReload(
      initial,
      "left",
      previous,
      swapped,
      { leftLineCount: 4, rightLineCount: 4 },
    );
    const committed = rebasePaneSnapshotAnchorLifecycleResult(
      prepared,
      initial,
      { leftLineCount: 4, rightLineCount: 4 },
      { deferValidation: true },
    );

    expect(committed.state.manualAnchors).toHaveLength(2);
    const finalized = finalizeDeferredAnchorValidation(
      committed.state,
      { leftLineCount: 4, rightLineCount: 4 },
      committed.validationOrigins,
    );

    expect(finalized.validationDeferred).toBe(false);
    expect(finalized.state.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 2 },
    ]);
    expect(finalized.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        reason: "reload-unresolved",
      },
    ]);
    expect(finalized.state.pendingLeftLineNo).toBe(2);
    expect(finalized.state.pendingRightLineNo).toBe(1);
    expect(finalized.state.selectedAnchorKey).toBeNull();
  });

  it.each([
    ["unresolved then shifted", ["left", "right"] as const],
    ["shifted then unresolved", ["right", "left"] as const],
  ])(
    "keeps mapper-unresolved stale coordinates at the shared prepare origin: %s",
    (_label, commitOrder) => {
      const previous = snapshot([
        { name: "pane.txt", text: "head\nfirst\ntarget\ntail" },
      ]);
      const withoutTarget = snapshot([
        { name: "pane.txt", text: "head\nfirst\nchanged\ntail" },
      ]);
      const shifted = snapshot([
        {
          name: "pane.txt",
          text: "inserted\nhead\nfirst\ntarget\ntail",
        },
      ]);
      const initial = state({
        pendingLeftLineNo: 2,
        pendingRightLineNo: 2,
      });
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

      let current = initial;
      commitOrder.forEach((side, index) => {
        current = rebasePaneSnapshotAnchorLifecycleResult(
          prepared[side],
          current,
          index === 0 && side === "left"
            ? { leftLineCount: 4, rightLineCount: 4 }
            : index === 0
              ? { leftLineCount: 4, rightLineCount: 5 }
              : { leftLineCount: 4, rightLineCount: 5 },
        ).state;
      });

      expect(current.manualAnchors).toEqual([]);
      expect(current.staleManualAnchors).toEqual([
        {
          anchor: { leftLineNo: 2, rightLineNo: 2 },
          reason: "reload-unresolved",
        },
      ]);
      expect(current.pendingLeftLineNo).toBeNull();
      expect(current.pendingRightLineNo).toBe(3);
      expect(current.selectedAnchorKey).toBeNull();
    },
  );

  it.each([
    ["left then right", ["left", "right"] as const],
    ["right then left", ["right", "left"] as const],
  ])(
    "rebases concurrent pane transitions without rolling back the opposite side: %s",
    (_label, commitOrder) => {
      const previous = snapshot([
        { name: "pane.txt", text: "head\nfirst\ntarget\ntail" },
      ]);
      const next = snapshot([
        {
          name: "pane.txt",
          text: "inserted\nhead\nfirst\ntarget\ntail",
        },
      ]);
      const initial = state({
        pendingLeftLineNo: 2,
        pendingRightLineNo: 2,
        staleManualAnchors: [
          {
            anchor: { leftLineNo: 3, rightLineNo: 3 },
            reason: "edit-unresolved",
          },
        ],
      });
      const prepared = {
        left: updateAnchorStateForPaneReload(
          initial,
          "left",
          previous,
          next,
          { leftLineCount: 5, rightLineCount: 4 },
        ),
        right: updateAnchorStateForPaneReload(
          initial,
          "right",
          previous,
          next,
          { leftLineCount: 4, rightLineCount: 5 },
        ),
      };
      expect(prepared.left.state.manualAnchors).toEqual([
        { leftLineNo: 3, rightLineNo: 2 },
      ]);
      expect(prepared.right.state.manualAnchors).toEqual([
        { leftLineNo: 2, rightLineNo: 3 },
      ]);

      let current = initial;
      commitOrder.forEach((side, index) => {
        current = rebasePaneSnapshotAnchorLifecycleResult(
          prepared[side],
          current,
          index === 0
            ? side === "left"
              ? { leftLineCount: 5, rightLineCount: 4 }
              : { leftLineCount: 4, rightLineCount: 5 }
            : { leftLineCount: 5, rightLineCount: 5 },
        ).state;
      });

      expect(current.manualAnchors).toEqual([
        { leftLineNo: 3, rightLineNo: 3 },
      ]);
      expect(current.staleManualAnchors).toEqual([
        {
          anchor: { leftLineNo: 3, rightLineNo: 3 },
          reason: "edit-unresolved",
        },
      ]);
      expect(current.pendingLeftLineNo).toBe(3);
      expect(current.pendingRightLineNo).toBe(3);
      expect(current.selectedAnchorKey).toBe("manual:3:3");
    },
  );

  it.each([
    ["reload then append", ["left", "right"] as const],
    ["append then reload", ["right", "left"] as const],
  ])(
    "rebases a concurrent reload and append transition: %s",
    (_label, commitOrder) => {
      const previous = snapshot([
        { name: "pane.txt", text: "head\nfirst\ntarget\ntail" },
      ]);
      const reloaded = snapshot([
        {
          name: "pane.txt",
          text: "inserted\nhead\nfirst\ntarget\ntail",
        },
      ]);
      const appended = snapshot([
        { name: "pane.txt", text: "head\nfirst\ntarget\ntail" },
        { name: "extra.txt", text: "extra" },
      ]);
      const initial = state({ pendingLeftLineNo: 2, pendingRightLineNo: 2 });
      const prepared = {
        left: updateAnchorStateForPaneReload(
          initial,
          "left",
          previous,
          reloaded,
          { leftLineCount: 5, rightLineCount: 4 },
        ),
        right: updateAnchorStateForPaneAppend(
          initial,
          "right",
          previous,
          appended,
          { leftLineCount: 4, rightLineCount: 5 },
        ),
      };

      let current = initial;
      commitOrder.forEach((side, index) => {
        current = rebasePaneSnapshotAnchorLifecycleResult(
          prepared[side],
          current,
          index === 0
            ? side === "left"
              ? { leftLineCount: 5, rightLineCount: 4 }
              : { leftLineCount: 4, rightLineCount: 5 }
            : { leftLineCount: 5, rightLineCount: 5 },
        ).state;
      });

      expect(current.manualAnchors).toEqual([
        { leftLineNo: 3, rightLineNo: 2 },
      ]);
      expect(current.pendingLeftLineNo).toBe(3);
      expect(current.pendingRightLineNo).toBe(2);
      expect(current.selectedAnchorKey).toBe("manual:3:2");
    },
  );

  it("prepares each pane snapshot once when relocating multiple tracked lines", () => {
    const previousValue = snapshot([
      { name: "left.txt", text: "head\nfirst\nsecond\nthird\ntail" },
    ]);
    const nextValue = snapshot([
      {
        name: "left.txt",
        text: "inserted\nhead\nfirst\nsecond\nthird\ntail",
      },
    ]);
    let previousTextReads = 0;
    let nextTextReads = 0;
    const previous = {
      get text() {
        previousTextReads += 1;
        return previousValue.text;
      },
      segments: previousValue.segments,
    };
    const next = {
      get text() {
        nextTextReads += 1;
        return nextValue.text;
      },
      segments: nextValue.segments,
    };

    const result = updateAnchorStateForPaneReload(
      state({
        manualAnchors: [
          { leftLineNo: 1, rightLineNo: 1 },
          { leftLineNo: 2, rightLineNo: 2 },
          { leftLineNo: 3, rightLineNo: 3 },
        ],
        pendingLeftLineNo: 4,
        selectedAnchorKey: "manual:2:2",
      }),
      "left",
      previous,
      next,
      { leftLineCount: 6, rightLineCount: 6 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 2, rightLineNo: 1 },
      { leftLineNo: 3, rightLineNo: 2 },
      { leftLineNo: 4, rightLineNo: 3 },
    ]);
    expect(result.state.pendingLeftLineNo).toBe(5);
    expect(previousTextReads).toBe(1);
    expect(nextTextReads).toBe(1);
  });

  it("relocates anchors and pending selection inside the same file", () => {
    const previous = snapshot([{ name: "left.txt", text: "head\na\ntarget\ntail" }]);
    const next = snapshot([
      { name: "left.txt", text: "inserted\nhead\na\ntarget\ntail" },
    ]);
    const result = updateAnchorStateForPaneReload(
      state({ pendingLeftLineNo: 1 }),
      "left",
      previous,
      next,
      { leftLineCount: 5, rightLineCount: 5 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 3, rightLineNo: 2 },
    ]);
    expect(result.state.pendingLeftLineNo).toBe(2);
    expect(result.state.selectedAnchorKey).toBe("manual:3:2");
  });

  it("deactivates ambiguous anchors and clears an ambiguous pending selection", () => {
    const previous = snapshot([{ name: "left.txt", text: "head\na\ntarget\ntail" }]);
    const next = snapshot([
      { name: "left.txt", text: "head\na\ntarget\ntarget\ntail" },
    ]);
    const result = updateAnchorStateForPaneReload(
      state({ pendingLeftLineNo: 2 }),
      "left",
      previous,
      next,
      { leftLineCount: 5, rightLineCount: 5 },
    );

    expect(result.state.manualAnchors).toEqual([]);
    expect(result.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "reload-unresolved",
      },
    ]);
    expect(result.state.pendingLeftLineNo).toBeNull();
    expect(result.state.selectedAnchorKey).toBeNull();
  });

  it("deactivates a remapped anchor when the pair order becomes invalid", () => {
    const previous = snapshot([
      { name: "left.txt", text: "head\nfirst\nsecond\ntail" },
    ]);
    const next = snapshot([
      { name: "left.txt", text: "head\nsecond\nfirst\ntail" },
    ]);
    const result = updateAnchorStateForPaneReload(
      state({
        manualAnchors: [
          { leftLineNo: 1, rightLineNo: 1 },
          { leftLineNo: 2, rightLineNo: 2 },
        ],
        selectedAnchorKey: null,
      }),
      "left",
      previous,
      next,
      { leftLineCount: 4, rightLineCount: 4 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 2 },
    ]);
    expect(result.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        reason: "reload-unresolved",
      },
    ]);
    expect(result.validationDeferred).toBe(false);
  });

  it("keeps an active anchor when reload relocates it onto historical stale coordinates", () => {
    const previous = snapshot([
      { name: "left.txt", text: "head\nactive\ntail" },
    ]);
    const next = snapshot([
      { name: "left.txt", text: "inserted\nhead\nactive\ntail" },
    ]);
    const result = updateAnchorStateForPaneReload(
      state({
        manualAnchors: [{ leftLineNo: 1, rightLineNo: 2 }],
        staleManualAnchors: [
          {
            anchor: { leftLineNo: 2, rightLineNo: 2 },
            reason: "reload-unresolved",
          },
        ],
        selectedAnchorKey: "manual:1:2",
      }),
      "left",
      previous,
      next,
      { leftLineCount: 4, rightLineCount: 4 },
    );

    expect(result.state.manualAnchors).toEqual([
      { leftLineNo: 2, rightLineNo: 2 },
    ]);
    expect(result.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 2 },
        reason: "reload-unresolved",
      },
    ]);
    expect(result.state.selectedAnchorKey).toBe("manual:2:2");
    expect(result.staleAdded).toBe(0);
  });
});
