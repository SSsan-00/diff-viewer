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

function findEqual(ops: PairedOp[], left: string, right: string): boolean {
  return ops.some(
    (op) =>
      op.type === "equal" &&
      (op.leftLine ?? "").includes(left) &&
      (op.rightLine ?? "").includes(right),
  );
}

describe("semantic alignment across languages", () => {
  it("aligns indent-only changes without breaking alignment", () => {
    const left = ["    var foo = 1;"];
    const right = ["var foo = 1;"];

    const ops = toPairedOps(left, right);
    expect(findEqual(ops, "var foo", "var foo")).toBe(false);
    expect(findReplace(ops, "var foo", "var foo")).toBe(true);
  });

  it("aligns indent-only comment lines with multibyte text", () => {
    const left = ["// ここはコメント行"];
    const right = ["        // ここはコメント行"];

    const ops = toPairedOps(left, right);
    expect(findEqual(ops, "ここはコメント行", "ここはコメント行")).toBe(false);
    expect(findReplace(ops, "ここはコメント行", "ここはコメント行")).toBe(true);
  });

  it("aligns indent-only keyword lines", () => {
    const left = ["break;", "else", "{"];
    const right = ["        break;", "        else", "        {"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "break", "break")).toBe(true);
    expect(findReplace(ops, "else", "else")).toBe(true);
    expect(findReplace(ops, "{", "{")).toBe(true);
  });

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

  it("aligns SQL construction across languages", () => {
    const left = [
      "StringBuilder sql = new();",
      "sql.AppendLine(\"select * from users\");",
      "sql.AppendLine(\"where name = 'taro'\");",
    ];
    const right = [
      "$sql = \"\";",
      "$sql .= \"select * from users\";",
      "$sql .= \"where name = 'taro'\";",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "StringBuilder sql", "$sql = \"\"")).toBe(true);
    expect(findReplace(ops, "select * from users", "select * from users")).toBe(true);
    expect(findReplace(ops, "where name = 'taro'", "where name = 'taro'")).toBe(true);
  });

  it("aligns SQL builder initialization with var keyword", () => {
    const left = ["var sql = new StringBuilder();"];
    const right = ["$sql = \"\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "var sql", "$sql = \"\"")).toBe(true);
  });

  it("aligns SQL date formatting across languages", () => {
    const left = ["$sql .= \", to_char(date, 'yyyy/mm/dd')\";"];
    const right = ["sql += \", FORMAT(date, 'yyyy/MM/dd')\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "to_char", "FORMAT")).toBe(true);
    expect(findEqual(ops, "to_char", "FORMAT")).toBe(false);
  });

  it("does not align date formatting when arguments differ", () => {
    const left = ["$sql .= \", to_char(date, 'yyyy/mm/dd')\";"];
    const right = ["sql += \", FORMAT(other, 'yyyy/MM/dd')\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "to_char", "FORMAT")).toBe(false);
  });

  it("aligns function declarations with modifiers when names match", () => {
    const left = ["public static string test() {", "return 1;", "}"];
    const right = ["function test() {", "return 1;", "}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "string test", "function test")).toBe(true);
  });

  it("aligns brace-only lines with different indentation", () => {
    const left = [
      "        function sumList(values) {",
      "          return values.reduce((total, value) => total + value, 0);",
      "        }",
    ];
    const right = [
      "function sumList(values) {",
      "  return values.reduce((total, value) => total + value, 0);",
      "}",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function sumList", "function sumList")).toBe(true);
    expect(findReplace(ops, "return values.reduce", "return values.reduce")).toBe(true);
    expect(findReplace(ops, "}", "}")).toBe(true);
    expect(findEqual(ops, "}", "}")).toBe(false);
  });

  it("aligns SQL construction across languages", () => {
    const left = ["builder.AppendLine(\"select * from users\");"];
    const right = ["$sql .= \"select * from users\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "AppendLine", "$sql")).toBe(true);
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

  it("does not align far apart similar function names across separate blocks", () => {
    const left = [
      "function test() {}",
      "A",
      "B",
      "C",
      "D",
      "E",
    ];
    const right = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "function test2() {}",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test()", "function test2()")).toBe(false);
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
