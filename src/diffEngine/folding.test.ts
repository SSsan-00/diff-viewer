import { describe, it, expect } from "vitest";
import type { PairedOp } from "./types";
import { buildFoldRanges, findFoldContainingRow } from "./folding";

describe("buildFoldRanges", () => {
  it("returns empty when equal blocks are below threshold", () => {
    const ops: PairedOp[] = [
      { type: "equal", leftLine: "a", rightLine: "a", leftLineNo: 0, rightLineNo: 0 },
      { type: "equal", leftLine: "b", rightLine: "b", leftLineNo: 1, rightLineNo: 1 },
      { type: "insert", rightLine: "x", rightLineNo: 2 },
    ];

    expect(
      buildFoldRanges(ops, { threshold: 4, keepHead: 1, keepTail: 1 }),
    ).toEqual([]);
  });

  it("computes hidden ranges with keepHead/keepTail", () => {
    const ops: PairedOp[] = [
      { type: "equal", leftLine: "0", rightLine: "0", leftLineNo: 0, rightLineNo: 0 },
      { type: "equal", leftLine: "1", rightLine: "1", leftLineNo: 1, rightLineNo: 1 },
      { type: "equal", leftLine: "2", rightLine: "2", leftLineNo: 2, rightLineNo: 2 },
      { type: "equal", leftLine: "3", rightLine: "3", leftLineNo: 3, rightLineNo: 3 },
      { type: "equal", leftLine: "4", rightLine: "4", leftLineNo: 4, rightLineNo: 4 },
      { type: "equal", leftLine: "5", rightLine: "5", leftLineNo: 5, rightLineNo: 5 },
      { type: "equal", leftLine: "6", rightLine: "6", leftLineNo: 6, rightLineNo: 6 },
      { type: "equal", leftLine: "7", rightLine: "7", leftLineNo: 7, rightLineNo: 7 },
      { type: "equal", leftLine: "8", rightLine: "8", leftLineNo: 8, rightLineNo: 8 },
      { type: "equal", leftLine: "9", rightLine: "9", leftLineNo: 9, rightLineNo: 9 },
    ];

    const folds = buildFoldRanges(ops, { threshold: 8, keepHead: 3, keepTail: 3 });

    expect(folds).toEqual([
      {
        startRow: 0,
        endRow: 9,
        hiddenStartRow: 3,
        hiddenEndRow: 6,
        hiddenCount: 4,
        totalCount: 10,
      },
    ]);
  });
});

describe("findFoldContainingRow", () => {
  it("finds a fold when row is in hidden range", () => {
    const folds = [
      {
        startRow: 0,
        endRow: 9,
        hiddenStartRow: 3,
        hiddenEndRow: 6,
        hiddenCount: 4,
        totalCount: 10,
      },
    ];

    expect(findFoldContainingRow(folds, 4)).toEqual(folds[0]);
    expect(findFoldContainingRow(folds, 7)).toBeUndefined();
  });
});
