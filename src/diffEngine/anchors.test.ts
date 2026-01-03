import { describe, it, expect } from "vitest";
import {
  addAnchor,
  diffWithAnchors,
  removeAnchorByLeft,
  removeAnchorByRight,
  validateAnchors,
  type Anchor,
} from "./anchors";

describe("validateAnchors", () => {
  it("filters out of range anchors", () => {
    const anchors: Anchor[] = [
      { leftLineNo: 0, rightLineNo: 0 },
      { leftLineNo: 3, rightLineNo: 1 },
    ];

    const result = validateAnchors(anchors, 2, 2);

    expect(result.valid).toEqual([{ leftLineNo: 0, rightLineNo: 0 }]);
    expect(result.invalid).toHaveLength(1);
  });

  it("filters duplicates and reversed order", () => {
    const anchors: Anchor[] = [
      { leftLineNo: 1, rightLineNo: 2 },
      { leftLineNo: 1, rightLineNo: 3 },
      { leftLineNo: 2, rightLineNo: 1 },
    ];

    const result = validateAnchors(anchors, 5, 5);

    expect(result.valid).toEqual([]);
    expect(result.invalid).toHaveLength(3);
  });
});

describe("diffWithAnchors", () => {
  it("always includes the anchor row", () => {
    const left = "a\nb\nc";
    const right = "a\nx\nc";
    const anchors: Anchor[] = [{ leftLineNo: 1, rightLineNo: 1 }];

    const ops = diffWithAnchors(left, right, anchors);

    expect(ops).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "b",
        rightLine: "x",
        leftLineNo: 1,
        rightLineNo: 1,
      },
      {
        type: "equal",
        leftLine: "c",
        rightLine: "c",
        leftLineNo: 2,
        rightLineNo: 2,
      },
    ]);
  });

  it("keeps original line numbers across segments", () => {
    const left = "a\nb\nc\nd";
    const right = "a\nx\nb\nc\nd";
    const anchors: Anchor[] = [{ leftLineNo: 2, rightLineNo: 3 }];

    const ops = diffWithAnchors(left, right, anchors);
    const anchorOp = ops.find(
      (op) => op.type === "equal" && op.leftLineNo === 2 && op.rightLineNo === 3,
    );

    expect(anchorOp).toBeDefined();
  });
});

describe("anchor helpers", () => {
  it("adds an anchor by returning a new list", () => {
    const anchors: Anchor[] = [{ leftLineNo: 1, rightLineNo: 2 }];
    const next = addAnchor(anchors, { leftLineNo: 3, rightLineNo: 4 });

    expect(next).toEqual([
      { leftLineNo: 1, rightLineNo: 2 },
      { leftLineNo: 3, rightLineNo: 4 },
    ]);
  });

  it("removes an anchor by left line number", () => {
    const anchors: Anchor[] = [
      { leftLineNo: 1, rightLineNo: 2 },
      { leftLineNo: 3, rightLineNo: 4 },
    ];

    const result = removeAnchorByLeft(anchors, 1);

    expect(result.removed).toEqual({ leftLineNo: 1, rightLineNo: 2 });
    expect(result.next).toEqual([{ leftLineNo: 3, rightLineNo: 4 }]);
  });

  it("removes an anchor by right line number", () => {
    const anchors: Anchor[] = [
      { leftLineNo: 1, rightLineNo: 2 },
      { leftLineNo: 3, rightLineNo: 4 },
    ];

    const result = removeAnchorByRight(anchors, 4);

    expect(result.removed).toEqual({ leftLineNo: 3, rightLineNo: 4 });
    expect(result.next).toEqual([{ leftLineNo: 1, rightLineNo: 2 }]);
  });
});
