import { describe, it, expect } from "vitest";
import type { LineOp } from "./types";
import { diffLines, diffLinesFromLines } from "./diffLines";
import { pairReplace } from "./pairReplace";

function compactOps(ops: LineOp[]): Record<string, unknown>[] {
  // Remove undefined fields so the intent is easier to read in tests.
  return ops.map((op) =>
    Object.fromEntries(Object.entries(op).filter(([, value]) => value !== undefined)),
  );
}

function exactLcsLength(left: string[], right: string[]): number {
  const previous = new Uint16Array(right.length + 1);
  const current = new Uint16Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current.fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = left[i - 1] === right[j - 1]
        ? previous[j - 1] + 1
        : Math.max(previous[j], current[j - 1]);
    }
    previous.set(current);
  }
  return previous[right.length];
}

function equalCount(ops: LineOp[]): number {
  return ops.filter((op) => op.type === "equal").length;
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

  it("keeps source line numbers after trimming a repeated common prefix", () => {
    const result = diffLines("A\nX\nA\nB", "A\nY\nA\nC");

    for (const op of result) {
      if (op.leftLineNo !== undefined) {
        expect(op.leftLine).toBe(["A", "X", "A", "B"][op.leftLineNo]);
      }
      if (op.rightLineNo !== undefined) {
        expect(op.rightLine).toBe(["A", "Y", "A", "C"][op.rightLineNo]);
      }
    }
  });

  it("uses exact compare lines rather than semantic names as patience anchors", () => {
    const result = compactOps(
      diffLines(
        "function test() {}\nvalue = old;\nclose();",
        "string test() {}\nvalue = new;\nclose();",
      ),
    );

    expect(result).toEqual([
      {
        type: "delete",
        leftLine: "function test() {}",
        leftLineNo: 0,
      },
      {
        type: "delete",
        leftLine: "value = old;",
        leftLineNo: 1,
      },
      {
        type: "insert",
        rightLine: "string test() {}",
        rightLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "value = new;",
        rightLineNo: 1,
      },
      {
        type: "equal",
        leftLine: "close();",
        rightLine: "close();",
        leftLineNo: 2,
        rightLineNo: 2,
      },
    ]);
  });

  it("preserves all exact repeated lines around a changed semantic line", () => {
    const result = diffLines(
      "close();\nvalue = oldSource;\nclose();\nclose();",
      "close();\nclose();\nclose();\nvalue = newSource;",
    );

    expect(
      result
        .filter((op) => op.type === "equal")
        .map((op) => [op.leftLineNo, op.rightLineNo]),
    ).toEqual([
      [0, 0],
      [2, 1],
      [3, 2],
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

  it("does not drop lines from either side when diffing shifted repeated blocks", () => {
    const left = [
      "HEADER",
      ...Array.from({ length: 180 }, (_, index) => `same-${index % 9}`),
      "LEFT-ONLY-1",
      "LEFT-ONLY-2",
      ...Array.from({ length: 180 }, (_, index) => `tail-${index % 7}`),
      "FOOTER",
    ];
    const right = [
      "HEADER",
      ...Array.from({ length: 90 }, (_, index) => `same-${index % 9}`),
      "RIGHT-ONLY-1",
      "RIGHT-ONLY-2",
      ...Array.from({ length: 270 }, (_, index) => `tail-${index % 7}`),
      "FOOTER",
    ];

    const ops = diffLinesFromLines(left, right);
    const projectedLeft = ops
      .filter((op) => op.type === "equal" || op.type === "delete")
      .map((op) => op.leftLine);
    const projectedRight = ops
      .filter((op) => op.type === "equal" || op.type === "insert")
      .map((op) => op.rightLine);

    expect(projectedLeft).toEqual(left);
    expect(projectedRight).toEqual(right);
  });

  it("keeps every source line visible after replace pairing", () => {
    const left = [
      "start",
      ...Array.from({ length: 150 }, (_, index) => `left-repeat-${index % 5}`),
      "function alpha() {",
      "  return 1;",
      "}",
      ...Array.from({ length: 150 }, (_, index) => `shared-${index % 8}`),
      "end",
    ];
    const right = [
      "start",
      ...Array.from({ length: 80 }, (_, index) => `right-repeat-${index % 5}`),
      "function alpha() {",
      "  return 2;",
      "}",
      ...Array.from({ length: 220 }, (_, index) => `shared-${index % 8}`),
      "end",
    ];

    const ops = pairReplace(diffLinesFromLines(left, right));
    const projectedLeft = ops
      .filter((op) => op.type === "equal" || op.type === "delete" || op.type === "replace")
      .map((op) => op.leftLine);
    const projectedRight = ops
      .filter((op) => op.type === "equal" || op.type === "insert" || op.type === "replace")
      .map((op) => op.rightLine);

    expect(projectedLeft).toEqual(left);
    expect(projectedRight).toEqual(right);
  });

  it("keeps the exact common-line coverage for moderately large repeated blocks", () => {
    const left = Array.from({ length: 180 }, (_, index) => `token-${index % 7}`);
    const right = [
      ...Array.from({ length: 40 }, (_, index) => `token-${(index + 3) % 7}`),
      ...left.slice(0, 120),
      ...Array.from({ length: 20 }, (_, index) => `token-${(index + 5) % 7}`),
    ];

    const ops = diffLinesFromLines(left, right);

    expect(equalCount(ops)).toBe(exactLcsLength(left, right));
  });
});
