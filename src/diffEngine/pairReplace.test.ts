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

  it("keeps leading inserts before matched replaces", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "L1", leftLineNo: 0 },
      { type: "delete", leftLine: "L2", leftLineNo: 1 },
      { type: "insert", rightLine: "// comment", rightLineNo: 0 },
      { type: "insert", rightLine: "L1", rightLineNo: 1 },
      { type: "insert", rightLine: "L2", rightLineNo: 2 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "insert",
        rightLine: "// comment",
        rightLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "L1",
        rightLine: "L1",
        leftLineNo: 0,
        rightLineNo: 1,
      },
      {
        type: "replace",
        leftLine: "L2",
        rightLine: "L2",
        leftLineNo: 1,
        rightLineNo: 2,
      },
    ]);
  });

  it("keeps inserts between matched replaces", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "L1", leftLineNo: 0 },
      { type: "delete", leftLine: "L2", leftLineNo: 1 },
      { type: "insert", rightLine: "L1", rightLineNo: 0 },
      { type: "insert", rightLine: "// mid", rightLineNo: 1 },
      { type: "insert", rightLine: "L2", rightLineNo: 2 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "L1",
        rightLine: "L1",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "// mid",
        rightLineNo: 1,
      },
      {
        type: "replace",
        leftLine: "L2",
        rightLine: "L2",
        leftLineNo: 1,
        rightLineNo: 2,
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

  it("does not pair close-but-different identifiers", () => {
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

  it("keeps later close-call replaces aligned after a single inserted call", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "$wbook->close;", leftLineNo: 61 },
      { type: "delete", leftLine: "$sheet->close;", leftLineNo: 62 },
      { type: "delete", leftLine: "$cell->close;", leftLineNo: 63 },
      { type: "delete", leftLine: "$row->close;", leftLineNo: 64 },
      { type: "delete", leftLine: "$style->close;", leftLineNo: 65 },
      { type: "insert", rightLine: "wbook.close();", rightLineNo: 61 },
      { type: "insert", rightLine: "sheet.open();", rightLineNo: 62 },
      { type: "insert", rightLine: "sheet.close();", rightLineNo: 63 },
      { type: "insert", rightLine: "cell.close();", rightLineNo: 64 },
      { type: "insert", rightLine: "row.close();", rightLineNo: 65 },
      { type: "insert", rightLine: "style.close();", rightLineNo: 66 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "$wbook->close;",
        rightLine: "wbook.close();",
        leftLineNo: 61,
        rightLineNo: 61,
      },
      {
        type: "insert",
        rightLine: "sheet.open();",
        rightLineNo: 62,
      },
      {
        type: "replace",
        leftLine: "$sheet->close;",
        rightLine: "sheet.close();",
        leftLineNo: 62,
        rightLineNo: 63,
      },
      {
        type: "replace",
        leftLine: "$cell->close;",
        rightLine: "cell.close();",
        leftLineNo: 63,
        rightLineNo: 64,
      },
      {
        type: "replace",
        leftLine: "$row->close;",
        rightLine: "row.close();",
        leftLineNo: 64,
        rightLineNo: 65,
      },
      {
        type: "replace",
        leftLine: "$style->close;",
        rightLine: "style.close();",
        leftLineNo: 65,
        rightLineNo: 66,
      },
    ]);
  });
});
