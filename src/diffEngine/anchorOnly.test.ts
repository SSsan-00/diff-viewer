import { describe, expect, it } from "vitest";
import { buildAnchorOnlyPairedOps } from "./anchorOnly";

describe("buildAnchorOnlyPairedOps", () => {
  it("does not mark different unanchored lines as diffs", () => {
    const ops = buildAnchorOnlyPairedOps("same\nleft changed", "same\nright changed", []);

    expect(ops).toEqual([
      {
        type: "equal",
        leftLine: "same",
        rightLine: "same",
        leftLineNo: 0,
        rightLineNo: 0,
        diffVisible: false,
      },
      {
        type: "equal",
        leftLine: "left changed",
        rightLine: "right changed",
        leftLineNo: 1,
        rightLineNo: 1,
        diffVisible: false,
      },
    ]);
  });

  it("marks only explicit anchor rows as replace diffs", () => {
    const ops = buildAnchorOnlyPairedOps(
      "same\nleft anchor\nleft tail",
      "same\nright anchor\nright tail",
      [{ leftLineNo: 1, rightLineNo: 1 }],
    );

    expect(ops).toEqual([
      {
        type: "equal",
        leftLine: "same",
        rightLine: "same",
        leftLineNo: 0,
        rightLineNo: 0,
        diffVisible: false,
      },
      {
        type: "replace",
        leftLine: "left anchor",
        rightLine: "right anchor",
        leftLineNo: 1,
        rightLineNo: 1,
      },
      {
        type: "equal",
        leftLine: "left tail",
        rightLine: "right tail",
        leftLineNo: 2,
        rightLineNo: 2,
        diffVisible: false,
      },
    ]);
  });

  it("keeps visual alignment gaps without making them visible diffs", () => {
    const ops = buildAnchorOnlyPairedOps(
      "left 1\nleft anchor",
      "right 1\nright extra\nright anchor",
      [{ leftLineNo: 1, rightLineNo: 2 }],
    );

    expect(ops).toEqual([
      {
        type: "equal",
        leftLine: "left 1",
        rightLine: "right 1",
        leftLineNo: 0,
        rightLineNo: 0,
        diffVisible: false,
      },
      {
        type: "insert",
        rightLine: "right extra",
        rightLineNo: 1,
        diffVisible: false,
      },
      {
        type: "replace",
        leftLine: "left anchor",
        rightLine: "right anchor",
        leftLineNo: 1,
        rightLineNo: 2,
      },
    ]);
  });
});
