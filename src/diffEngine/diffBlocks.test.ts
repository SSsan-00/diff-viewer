import { describe, it, expect } from "vitest";
import type { PairedOp } from "./types";
import { getDiffBlockStarts, mapRowToLineNumbers } from "./diffBlocks";

describe("getDiffBlockStarts", () => {
  it("returns empty when all ops are equal", () => {
    const ops: PairedOp[] = [
      { type: "equal", leftLine: "a", rightLine: "a", leftLineNo: 0, rightLineNo: 0 },
      { type: "equal", leftLine: "b", rightLine: "b", leftLineNo: 1, rightLineNo: 1 },
    ];

    expect(getDiffBlockStarts(ops)).toEqual([]);
  });

  it("extracts the start index of each non-equal block", () => {
    const ops: PairedOp[] = [
      { type: "equal", leftLine: "a", rightLine: "a", leftLineNo: 0, rightLineNo: 0 },
      { type: "delete", leftLine: "x", leftLineNo: 1 },
      { type: "insert", rightLine: "y", rightLineNo: 1 },
      { type: "equal", leftLine: "b", rightLine: "b", leftLineNo: 2, rightLineNo: 2 },
      { type: "replace", leftLine: "c", rightLine: "d", leftLineNo: 3, rightLineNo: 3 },
      { type: "insert", rightLine: "e", rightLineNo: 4 },
    ];

    expect(getDiffBlockStarts(ops)).toEqual([1, 4]);
  });
});

describe("mapRowToLineNumbers", () => {
  const ops: PairedOp[] = [
    { type: "equal", leftLine: "a", rightLine: "a", leftLineNo: 0, rightLineNo: 0 },
    { type: "delete", leftLine: "x", leftLineNo: 1 },
    { type: "insert", rightLine: "y", rightLineNo: 1 },
    { type: "replace", leftLine: "b", rightLine: "c", leftLineNo: 2, rightLineNo: 2 },
    { type: "equal", leftLine: "d", rightLine: "d", leftLineNo: 3, rightLineNo: 3 },
  ];

  it("maps row indices to left/right line numbers", () => {
    expect(mapRowToLineNumbers(ops, 0)).toEqual({ leftLineNo: 0, rightLineNo: 0 });
    expect(mapRowToLineNumbers(ops, 1)).toEqual({ leftLineNo: 1, rightLineNo: 1 });
    expect(mapRowToLineNumbers(ops, 2)).toEqual({ leftLineNo: 2, rightLineNo: 1 });
    expect(mapRowToLineNumbers(ops, 3)).toEqual({ leftLineNo: 2, rightLineNo: 2 });
    expect(mapRowToLineNumbers(ops, 4)).toEqual({ leftLineNo: 3, rightLineNo: 3 });
  });
});
