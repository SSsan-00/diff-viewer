import { describe, expect, it } from "vitest";
import { resetAllAnchors, type AnchorResetState } from "./anchorReset";

describe("resetAllAnchors", () => {
  it("clears anchor state and decorations for both panes", () => {
    const leftCalls: Array<{ old: string[]; next: unknown[] }> = [];
    const rightCalls: Array<{ old: string[]; next: unknown[] }> = [];
    const editors = {
      leftEditor: {
        deltaDecorations: (oldDecorations: string[], newDecorations: unknown[]) => {
          leftCalls.push({ old: oldDecorations, next: newDecorations });
          return [];
        },
      },
      rightEditor: {
        deltaDecorations: (oldDecorations: string[], newDecorations: unknown[]) => {
          rightCalls.push({ old: oldDecorations, next: newDecorations });
          return [];
        },
      },
    };

    const state: AnchorResetState = {
      manualAnchors: [{ leftLineNo: 1, rightLineNo: 2 }],
      autoAnchor: { leftLineNo: 3, rightLineNo: 4 },
      suppressedAutoAnchorKey: "auto:1:2",
      pendingLeftLineNo: 10,
      pendingRightLineNo: 20,
      selectedAnchorKey: "manual:1:2",
      pendingLeftDecorationIds: ["pl-1"],
      pendingRightDecorationIds: ["pr-1"],
      leftAnchorDecorationIds: ["la-1"],
      rightAnchorDecorationIds: ["ra-1"],
      leftFocusDecorationIds: ["lf-1"],
      rightFocusDecorationIds: ["rf-1"],
    };

    const next = resetAllAnchors(state, editors);

    expect(next.manualAnchors).toEqual([]);
    expect(next.autoAnchor).toBeNull();
    expect(next.suppressedAutoAnchorKey).toBeNull();
    expect(next.pendingLeftLineNo).toBeNull();
    expect(next.pendingRightLineNo).toBeNull();
    expect(next.selectedAnchorKey).toBeNull();
    expect(next.pendingLeftDecorationIds).toEqual([]);
    expect(next.pendingRightDecorationIds).toEqual([]);
    expect(next.leftAnchorDecorationIds).toEqual([]);
    expect(next.rightAnchorDecorationIds).toEqual([]);
    expect(next.leftFocusDecorationIds).toEqual([]);
    expect(next.rightFocusDecorationIds).toEqual([]);

    expect(leftCalls).toEqual([
      { old: ["pl-1"], next: [] },
      { old: ["la-1"], next: [] },
      { old: ["lf-1"], next: [] },
    ]);
    expect(rightCalls).toEqual([
      { old: ["pr-1"], next: [] },
      { old: ["ra-1"], next: [] },
      { old: ["rf-1"], next: [] },
    ]);
  });
});
