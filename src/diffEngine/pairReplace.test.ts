import { describe, it, expect } from "vitest";
import type { LineOp, PairedOp } from "./types";
import { pairReplace } from "./pairReplace";

function compactOps(ops: PairedOp[]): Record<string, unknown>[] {
  // Drop undefined fields to keep expectations readable.
  return ops.map((op) =>
    Object.fromEntries(Object.entries(op).filter(([, value]) => value !== undefined)),
  );
}

describe("pairReplace", () => {
  it("does not create replace when there is no following insert block", () => {
    const input: LineOp[] = [
      { type: "equal", leftLine: "a", rightLine: "a", leftLineNo: 0, rightLineNo: 0 },
      { type: "delete", leftLine: "b", leftLineNo: 1 },
      { type: "equal", leftLine: "c", rightLine: "c", leftLineNo: 2, rightLineNo: 1 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "delete",
        leftLine: "b",
        leftLineNo: 1,
      },
      {
        type: "equal",
        leftLine: "c",
        rightLine: "c",
        leftLineNo: 2,
        rightLineNo: 1,
      },
    ]);
  });

  it("pairs a single delete and insert into replace when keys match", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "$foo = 1;", leftLineNo: 0 },
      { type: "insert", rightLine: "var foo = 1;", rightLineNo: 0 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "$foo = 1;",
        rightLine: "var foo = 1;",
        leftLineNo: 0,
        rightLineNo: 0,
      },
    ]);
  });

  it("leaves extra deletes when deletes outnumber inserts", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "aaa", leftLineNo: 0 },
      { type: "delete", leftLine: "bbb", leftLineNo: 1 },
      { type: "insert", rightLine: "bbb", rightLineNo: 0 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "delete",
        leftLine: "aaa",
        leftLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "bbb",
        rightLine: "bbb",
        leftLineNo: 1,
        rightLineNo: 0,
      },
    ]);
  });

  it("leaves extra inserts when inserts outnumber deletes", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "foo", leftLineNo: 0 },
      { type: "insert", rightLine: "foo", rightLineNo: 0 },
      { type: "insert", rightLine: "bar", rightLineNo: 1 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "foo",
        rightLine: "foo",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "bar",
        rightLineNo: 1,
      },
    ]);
  });

  it("prioritizes indent similarity when pairing", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "  $foo = 1;", leftLineNo: 0 },
      { type: "delete", leftLine: "$bar = 2;", leftLineNo: 1 },
      { type: "insert", rightLine: "  var foo = 1;", rightLineNo: 0 },
      { type: "insert", rightLine: "var bar = 2;", rightLineNo: 1 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "  $foo = 1;",
        rightLine: "  var foo = 1;",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "$bar = 2;",
        rightLine: "var bar = 2;",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ]);
  });

  it("pairs in original order when scores are tied", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "$foo = 1;", leftLineNo: 0 },
      { type: "delete", leftLine: "$bar = 2;", leftLineNo: 1 },
      { type: "insert", rightLine: "var foo = 1;", rightLineNo: 0 },
      { type: "insert", rightLine: "var bar = 2;", rightLineNo: 1 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "$foo = 1;",
        rightLine: "var foo = 1;",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "$bar = 2;",
        rightLine: "var bar = 2;",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ]);
  });

  it("does not pair when keys do not match", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "var foo = 1;", leftLineNo: 0 },
      { type: "insert", rightLine: "var food = 1;", rightLineNo: 0 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "delete",
        leftLine: "var foo = 1;",
        leftLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "var food = 1;",
        rightLineNo: 0,
      },
    ]);
  });
});
