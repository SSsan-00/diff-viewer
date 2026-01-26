import { describe, it, expect } from "vitest";
import type { LineOp } from "./types";
import { diffLines } from "./diffLines";

function compactOps(ops: LineOp[]): Record<string, unknown>[] {
  // Remove undefined fields so the intent is easier to read in tests.
  return ops.map((op) =>
    Object.fromEntries(Object.entries(op).filter(([, value]) => value !== undefined)),
  );
}

describe("diffLines", () => {
  it("returns equal ops for identical texts with matching line numbers", () => {
    const result = compactOps(diffLines("a\nb", "a\nb"));

    expect(result).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "equal",
        leftLine: "b",
        rightLine: "b",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ]);
  });

  it("emits an insert when the right side adds a line", () => {
    const result = compactOps(diffLines("a", "a\nb"));

    expect(result).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "b",
        rightLineNo: 1,
      },
    ]);
  });

  it("emits a delete when the left side has an extra line", () => {
    const result = compactOps(diffLines("a\nb", "a"));

    expect(result).toEqual([
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
    ]);
  });

  it("treats trailing newline presence as a diff", () => {
    const result = compactOps(diffLines("a\n", "a"));

    expect(result).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "delete",
        leftLine: "",
        leftLineNo: 1,
      },
    ]);
  });

  it("returns delete/insert for changed middle line (no replace yet)", () => {
    const result = compactOps(diffLines("a\nx\nb", "a\ny\nb"));

    expect(result).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "delete",
        leftLine: "x",
        leftLineNo: 1,
      },
      {
        type: "insert",
        rightLine: "y",
        rightLineNo: 1,
      },
      {
        type: "equal",
        leftLine: "b",
        rightLine: "b",
        leftLineNo: 2,
        rightLineNo: 2,
      },
    ]);
  });

  it("treats whitespace-only lines as equal", () => {
    const result = compactOps(diffLines("a\n \nb", "a\n\t\nb"));

    expect(result).toEqual([
      {
        type: "equal",
        leftLine: "a",
        rightLine: "a",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "equal",
        leftLine: " ",
        rightLine: "\t",
        leftLineNo: 1,
        rightLineNo: 1,
      },
      {
        type: "equal",
        leftLine: "b",
        rightLine: "b",
        leftLineNo: 2,
        rightLineNo: 2,
      },
    ]);
  });
});
