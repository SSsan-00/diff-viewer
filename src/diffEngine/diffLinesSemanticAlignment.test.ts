import { describe, it, expect } from "vitest";
import { diffLinesFromLines } from "./diffLines";
import { pairReplace } from "./pairReplace";
import { diffWithAnchors, type Anchor } from "./anchors";
import type { PairedOp } from "./types";

function toPairedOps(left: string[], right: string[]): PairedOp[] {
  return pairReplace(diffLinesFromLines(left, right));
}

function findReplace(ops: PairedOp[], left: string, right: string): boolean {
  return ops.some(
    (op) =>
      op.type === "replace" &&
      (op.leftLine ?? "").includes(left) &&
      (op.rightLine ?? "").includes(right),
  );
}

describe("semantic alignment across languages", () => {
  it("aligns variable lines with different syntax", () => {
    const left = ["$foo = 1;", "$bar = 2;"];
    const right = ["var foo = 1;", "var bar = 2;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "$foo", "var foo")).toBe(true);
  });

  it("aligns function declarations with different return types", () => {
    const left = ["function test() {", "return 1;", "}"];
    const right = ["string test() {", "return 1;", "}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test", "string test")).toBe(true);
  });

  it("allows argument notation differences when function name matches", () => {
    const left = ["function test($x) {", "return $x;", "}"];
    const right = ["string test(int x) {", "return x;", "}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test", "string test")).toBe(true);
  });

  it("aligns constant definitions across languages", () => {
    const left = ["define('FOO','foo');"];
    const right = ["public readonly string FOO = 'foo';"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "define('FOO'", "FOO = 'foo'")).toBe(true);
  });

  it("aligns property references to variable declarations", () => {
    const left = ["this.foo = 1;"];
    const right = ["$foo = 1;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "this.foo", "$foo")).toBe(true);
  });

  it("aligns function calls with argument notation differences", () => {
    const left = ["test($x);"];
    const right = ["test(x);"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "test($x)", "test(x)")).toBe(true);
  });

  it("does not align close-but-different variable names", () => {
    const left = ["var foo = 1;"];
    const right = ["var food = 1;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "foo", "food")).toBe(false);
  });

  it("does not align close-but-different function names", () => {
    const left = ["function test() {}"];
    const right = ["function test2() {}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "test()", "test2()")).toBe(false);
  });

  it("respects anchors as hard boundaries", () => {
    const left = ["TOP", "$foo = 1;", "ANCHOR", "function test() {}"];
    const right = ["TOP", "var foo = 1;", "ANCHOR", "string test() {}"];
    const anchors: Anchor[] = [{ leftLineNo: 2, rightLineNo: 2 }];

    const ops = diffWithAnchors(left.join("\n"), right.join("\n"), anchors);
    const anchorOp = ops.find(
      (op) => op.leftLine === "ANCHOR" && op.rightLine === "ANCHOR",
    );

    expect(anchorOp).toBeDefined();
    expect(findReplace(ops, "$foo", "var foo")).toBe(true);
    expect(findReplace(ops, "function test", "string test")).toBe(true);
  });
});
