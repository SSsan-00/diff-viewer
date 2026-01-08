import { describe, it, expect } from "vitest";
import { handleLeftAnchorClick, handleRightAnchorClick } from "./anchorClick";
import type { Anchor } from "../diffEngine/anchors";

describe("anchor click interactions", () => {
  it("toggles pending selection on the same left line", () => {
    const first = handleLeftAnchorClick({
      manualAnchors: [],
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      lineNo: 3,
    });

    expect(first.action).toBe("pending-set");
    expect(first.pendingLeftLineNo).toBe(3);

    const second = handleLeftAnchorClick({
      ...first,
      lineNo: 3,
    });

    expect(second.action).toBe("pending-cleared");
    expect(second.pendingLeftLineNo).toBeNull();
  });

  it("adds an anchor when the opposite side is pending", () => {
    const result = handleLeftAnchorClick({
      manualAnchors: [],
      pendingLeftLineNo: null,
      pendingRightLineNo: 5,
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      lineNo: 2,
    });

    expect(result.action).toBe("added");
    expect(result.pendingRightLineNo).toBeNull();
    expect(result.manualAnchors).toHaveLength(1);
    expect(result.manualAnchors[0]).toEqual({ leftLineNo: 2, rightLineNo: 5 });
  });

  it("removes a manual anchor from either side", () => {
    const anchors: Anchor[] = [{ leftLineNo: 1, rightLineNo: 2 }];

    const leftRemoval = handleLeftAnchorClick({
      manualAnchors: anchors,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      lineNo: 1,
    });

    expect(leftRemoval.action).toBe("removed");
    expect(leftRemoval.manualAnchors).toHaveLength(0);

    const rightRemoval = handleRightAnchorClick({
      manualAnchors: anchors,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      lineNo: 2,
    });

    expect(rightRemoval.action).toBe("removed");
    expect(rightRemoval.manualAnchors).toHaveLength(0);
  });

  it("removes auto anchors and records suppression keys", () => {
    const autoAnchor = { leftLineNo: 4, rightLineNo: 7 };

    const result = handleLeftAnchorClick({
      manualAnchors: [],
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor,
      suppressedAutoAnchorKey: null,
      lineNo: 4,
    });

    expect(result.action).toBe("auto-removed");
    expect(result.autoAnchor).toBeNull();
    expect(result.suppressedAutoAnchorKey).toBe("auto:4:7");
  });
});
