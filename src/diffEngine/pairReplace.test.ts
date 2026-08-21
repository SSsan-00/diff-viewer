import { describe, it, expect } from "vitest";
import type { LineOp, PairedOp } from "./types";
import { buildPairCandidates, pairReplace } from "./pairReplace";

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

  it("pairs the same assignment target when only the right-hand side changes", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "const total = oldValue;", leftLineNo: 0 },
      { type: "insert", rightLine: "const total = newValue;", rightLineNo: 0 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "replace",
        leftLine: "const total = oldValue;",
        rightLine: "const total = newValue;",
        leftLineNo: 0,
        rightLineNo: 0,
      },
    ]);
  });

  it("does not pair different assignment targets through a shared right-hand side", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "foo = sharedDependency;", leftLineNo: 0 },
      { type: "insert", rightLine: "baz = sharedDependency;", rightLineNo: 0 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "delete",
        leftLine: "foo = sharedDependency;",
        leftLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "baz = sharedDependency;",
        rightLineNo: 0,
      },
    ]);
  });

  it("keeps same-target assignments aligned inside an ordered replace block", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "foo = sharedDependency;", leftLineNo: 0 },
      { type: "delete", leftLine: "bar = oldValue;", leftLineNo: 1 },
      { type: "insert", rightLine: "bar = newValue;", rightLineNo: 0 },
      { type: "insert", rightLine: "baz = sharedDependency;", rightLineNo: 1 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "delete",
        leftLine: "foo = sharedDependency;",
        leftLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "bar = oldValue;",
        rightLine: "bar = newValue;",
        leftLineNo: 1,
        rightLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "baz = sharedDependency;",
        rightLineNo: 1,
      },
    ]);
  });

  it("pairs same-name declarations and calls but rejects different names", () => {
    const sameName: LineOp[] = [
      { type: "delete", leftLine: "function render(oldValue) {}", leftLineNo: 0 },
      { type: "insert", rightLine: "string render(NewValue value) {}", rightLineNo: 0 },
      { type: "delete", leftLine: "ui.refresh(oldValue);", leftLineNo: 1 },
      { type: "insert", rightLine: "refresh(newValue);", rightLineNo: 1 },
    ];
    const differentNames: LineOp[] = [
      { type: "delete", leftLine: "render(sharedValue);", leftLineNo: 0 },
      { type: "insert", rightLine: "refresh(sharedValue);", rightLineNo: 0 },
    ];

    expect(compactOps(pairReplace(sameName))).toEqual([
      {
        type: "replace",
        leftLine: "function render(oldValue) {}",
        rightLine: "string render(NewValue value) {}",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "ui.refresh(oldValue);",
        rightLine: "refresh(newValue);",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ]);
    expect(compactOps(pairReplace(differentNames))).toEqual([
      {
        type: "delete",
        leftLine: "render(sharedValue);",
        leftLineNo: 0,
      },
      {
        type: "insert",
        rightLine: "refresh(sharedValue);",
        rightLineNo: 0,
      },
    ]);
  });

  it("bounds candidate generation for frequent shared tokens", () => {
    const lineCount = 400;
    const deletes: LineOp[] = Array.from({ length: lineCount }, (_, index) => ({
      type: "delete" as const,
      leftLine: `sharedTarget = left${index};`,
      leftLineNo: index,
    }));
    const inserts: LineOp[] = Array.from({ length: lineCount }, (_, index) => ({
      type: "insert" as const,
      rightLine: `sharedTarget = right${index};`,
      rightLineNo: index,
    }));

    expect(buildPairCandidates(deletes, inserts).length).toBeLessThanOrEqual(
      lineCount * 100,
    );
    const result = pairReplace([...deletes, ...inserts]);

    expect(result).toHaveLength(lineCount);
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

  it("prefers the best ordered same-name chain over an unrelated early literal match", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "value.AppendLine(\"close\");", leftLineNo: 101 },
      { type: "delete", leftLine: "return $row_write;", leftLineNo: 102 },
      { type: "delete", leftLine: "$wbook->append;", leftLineNo: 103 },
      { type: "delete", leftLine: "return $table_load;", leftLineNo: 104 },
      { type: "insert", rightLine: "html.AppendLine(\"render\");", rightLineNo: 201 },
      { type: "insert", rightLine: "return row_render;", rightLineNo: 202 },
      { type: "insert", rightLine: "wbook.AppendLine(\"append\");", rightLineNo: 203 },
      { type: "insert", rightLine: "sheet.render();", rightLineNo: 204 },
      { type: "insert", rightLine: "html.load();", rightLineNo: 205 },
      { type: "insert", rightLine: "$value->close;", rightLineNo: 206 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "delete",
        leftLine: "value.AppendLine(\"close\");",
        leftLineNo: 101,
      },
      {
        type: "delete",
        leftLine: "return $row_write;",
        leftLineNo: 102,
      },
      {
        type: "insert",
        rightLine: "html.AppendLine(\"render\");",
        rightLineNo: 201,
      },
      {
        type: "insert",
        rightLine: "return row_render;",
        rightLineNo: 202,
      },
      {
        type: "replace",
        leftLine: "$wbook->append;",
        rightLine: "wbook.AppendLine(\"append\");",
        leftLineNo: 103,
        rightLineNo: 203,
      },
      {
        type: "delete",
        leftLine: "return $table_load;",
        leftLineNo: 104,
      },
      {
        type: "insert",
        rightLine: "sheet.render();",
        rightLineNo: 204,
      },
      {
        type: "insert",
        rightLine: "html.load();",
        rightLineNo: 205,
      },
      {
        type: "insert",
        rightLine: "$value->close;",
        rightLineNo: 206,
      },
    ]);
  });

  it("pairs far-shifted AppendLine payload text outside the local window", () => {
    const setupInserts: LineOp[] = Array.from({ length: 48 }, (_, index) => ({
      type: "insert" as const,
      rightLine: `var setup${index} = ${index};`,
      rightLineNo: index,
    }));
    const input: LineOp[] = [
      { type: "delete", leftLine: "ようこそ", leftLineNo: 1 },
      ...setupInserts,
      { type: "insert", rightLine: "sb.AppendLine(\"ようこそ\");", rightLineNo: 100 },
    ];

    expect(compactOps(pairReplace(input))).toContainEqual({
      type: "replace",
      leftLine: "ようこそ",
      rightLine: "sb.AppendLine(\"ようこそ\");",
      leftLineNo: 1,
      rightLineNo: 100,
    });
  });

  it("pairs far-shifted bracketed prefix comments with plain line comments by body", () => {
    const setupInserts: LineOp[] = Array.from({ length: 48 }, (_, index) => ({
      type: "insert" as const,
      rightLine: `// setup ${index}`,
      rightLineNo: index,
    }));
    const input: LineOp[] = [
      {
        type: "delete",
        leftLine: "//// [未使用関数]   : public string FormatName(User user)",
        leftLineNo: 1,
      },
      ...setupInserts,
      {
        type: "insert",
        rightLine: "// private string FormatName(User user)",
        rightLineNo: 100,
      },
    ];

    expect(compactOps(pairReplace(input))).toContainEqual({
      type: "replace",
      leftLine: "//// [未使用関数]   : public string FormatName(User user)",
      rightLine: "// private string FormatName(User user)",
      leftLineNo: 1,
      rightLineNo: 100,
    });
  });

  it("pairs far-shifted bracketed prefix comments when the body has no identifiers", () => {
    const setupInserts: LineOp[] = Array.from({ length: 48 }, (_, index) => ({
      type: "insert" as const,
      rightLine: `// setup ${index}`,
      rightLineNo: index,
    }));
    const input: LineOp[] = [
      {
        type: "delete",
        leftLine: "//// [memo] : ようこそ",
        leftLineNo: 1,
      },
      ...setupInserts,
      {
        type: "insert",
        rightLine: "// ようこそ",
        rightLineNo: 100,
      },
    ];

    expect(compactOps(pairReplace(input))).toContainEqual({
      type: "replace",
      leftLine: "//// [memo] : ようこそ",
      rightLine: "// ようこそ",
      leftLineNo: 1,
      rightLineNo: 100,
    });
  });

  it("does not use plain comment bodies as a special pairing key without bracketed prefix comments", () => {
    const input: LineOp[] = [
      { type: "delete", leftLine: "// TODO: later", leftLineNo: 1 },
      { type: "insert", rightLine: "return later;", rightLineNo: 1 },
    ];

    expect(compactOps(pairReplace(input))).toEqual([
      {
        type: "delete",
        leftLine: "// TODO: later",
        leftLineNo: 1,
      },
      {
        type: "insert",
        rightLine: "return later;",
        rightLineNo: 1,
      },
    ]);
  });
});
