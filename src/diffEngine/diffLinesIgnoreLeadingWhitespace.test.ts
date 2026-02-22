import { describe, expect, it } from "vitest";
import { diffLines } from "./diffLines";
import { pairReplace } from "./pairReplace";
import { diffInlineWithAppendLiteral } from "./diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./htmlAttributeSpaceDiff";
import type { LineOp } from "./types";

type DiffLinesWithOptions = (
  leftText: string,
  rightText: string,
  options?: { ignoreLeadingFileWhitespace?: boolean },
) => LineOp[];

const diffLinesWithOptions = diffLines as unknown as DiffLinesWithOptions;

function visibleLineDiffs(ops: LineOp[]): LineOp[] {
  return ops.filter((op) => op.type === "insert" || op.type === "delete");
}

function leadingVisibleDiffsBeforeFirstEqual(ops: LineOp[]): LineOp[] {
  const firstEqualIndex = ops.findIndex((op) => op.type === "equal");
  if (firstEqualIndex === -1) {
    return visibleLineDiffs(ops);
  }
  return ops
    .slice(0, firstEqualIndex)
    .filter((op) => op.type === "insert" || op.type === "delete");
}

function hasLeadingDiffBeforeFirstEqual(ops: LineOp[]): boolean {
  return leadingVisibleDiffsBeforeFirstEqual(ops).length > 0;
}

function firstEqualOp(ops: LineOp[]): (LineOp & { type: "equal" }) | undefined {
  return ops.find((op): op is LineOp & { type: "equal" } => op.type === "equal");
}

describe("diffLines ignore leading file whitespace", () => {
  it("Case1: ignores leading spaces at line start when enabled", () => {
    const left = "    <head>\n<body>";
    const right = "<head>\n<body>";

    const off = diffLines(left, right);
    const on = diffLinesWithOptions(left, right, { ignoreLeadingFileWhitespace: true });

    expect(hasLeadingDiffBeforeFirstEqual(off)).toBe(true);
    expect(hasLeadingDiffBeforeFirstEqual(on)).toBe(false);
    expect(firstEqualOp(on)?.leftLineNo).toBe(0);
    expect(firstEqualOp(on)?.rightLineNo).toBe(0);
  });

  it("matches user Case1: const line with only line-start indentation difference", () => {
    const left = "const total = sumList(numbers);";
    const right = "    const total = sumList(numbers);";

    const off = diffLines(left, right);
    const on = diffLinesWithOptions(left, right, { ignoreLeadingFileWhitespace: true });

    expect(hasLeadingDiffBeforeFirstEqual(off)).toBe(true);
    expect(visibleLineDiffs(on)).toHaveLength(0);
    expect(firstEqualOp(on)).toMatchObject({
      type: "equal",
      leftLineNo: 0,
      rightLineNo: 0,
    });
  });

  it("Case2: ignores tab vs spaces at line start", () => {
    const on = diffLinesWithOptions("\t<head>", "    <head>", {
      ignoreLeadingFileWhitespace: true,
    });

    expect(visibleLineDiffs(on)).toHaveLength(0);
    expect(firstEqualOp(on)?.leftLine).toBe("\t<head>");
    expect(firstEqualOp(on)?.rightLine).toBe("    <head>");
  });

  it("Case3: ignores spaces vs multiple tabs at line start", () => {
    const on = diffLinesWithOptions(" <html>", "\t\t<html>", {
      ignoreLeadingFileWhitespace: true,
    });

    expect(visibleLineDiffs(on)).toHaveLength(0);
    expect(firstEqualOp(on)?.leftLineNo).toBe(0);
    expect(firstEqualOp(on)?.rightLineNo).toBe(0);
  });

  it("Case4: aligns HTML start when only line-start whitespace differs", () => {
    const on = diffLinesWithOptions("   <head>\n<title>x</title>", "<head>\n<title>x</title>", {
      ignoreLeadingFileWhitespace: true,
    });

    const first = firstEqualOp(on);
    expect(first?.leftLine).toBe("   <head>");
    expect(first?.rightLine).toBe("<head>");
    expect(hasLeadingDiffBeforeFirstEqual(on)).toBe(false);
  });

  it("Case5: ignores indentation differences on later lines too", () => {
    const on = diffLinesWithOptions("line1\n  line2", "line1\n\tline2", {
      ignoreLeadingFileWhitespace: true,
    });

    const line2Diffs = on.filter(
      (op) =>
        (op.type === "insert" && op.rightLineNo === 1) ||
        (op.type === "delete" && op.leftLineNo === 1),
    );
    expect(line2Diffs).toHaveLength(0);
    const line2Equal = on.find(
      (op) => op.type === "equal" && op.leftLineNo === 1 && op.rightLineNo === 1,
    );
    expect(line2Equal).toBeTruthy();
  });

  it("Case6: still applies to later lines even when the file starts with a newline", () => {
    const left = "\n    <head>";
    const right = "\n<head>";

    const off = diffLines(left, right);
    const on = diffLinesWithOptions(left, right, { ignoreLeadingFileWhitespace: true });

    const offLine1Diffs = off.filter(
      (op) =>
        (op.type === "insert" && op.rightLineNo === 1) ||
        (op.type === "delete" && op.leftLineNo === 1),
    );
    const onLine1Diffs = on.filter(
      (op) =>
        (op.type === "insert" && op.rightLineNo === 1) ||
        (op.type === "delete" && op.leftLineNo === 1),
    );
    expect(offLine1Diffs.length).toBeGreaterThan(0);
    expect(onLine1Diffs).toHaveLength(0);
  });

  it("Case7: handles whitespace-only content at file start without breaking alignment", () => {
    const on = diffLinesWithOptions("   ", "", { ignoreLeadingFileWhitespace: true });

    expect(visibleLineDiffs(on)).toHaveLength(0);
    expect(firstEqualOp(on)).toBeTruthy();
  });

  it("Case8: works with AppendLine payload on later lines too", () => {
    const left = 'PREV\nsb.AppendLine("    <head>");\nNEXT';
    const right = 'PREV\nsb.AppendLine("<head>");\nNEXT';

    const off = diffLines(left, right);
    const on = diffLinesWithOptions(left, right, { ignoreLeadingFileWhitespace: true });

    const offMiddleDiffs = off.filter(
      (op) =>
        (op.type === "insert" && op.rightLineNo === 1) ||
        (op.type === "delete" && op.leftLineNo === 1),
    );
    const onMiddleDiffs = on.filter(
      (op) =>
        (op.type === "insert" && op.rightLineNo === 1) ||
        (op.type === "delete" && op.leftLineNo === 1),
    );
    expect(offMiddleDiffs.length).toBeGreaterThan(0);
    expect(onMiddleDiffs).toHaveLength(0);
    const nextEqual = on.find(
      (op) => op.type === "equal" && op.leftLine === "NEXT" && op.rightLine === "NEXT",
    );
    expect(nextEqual).toBeTruthy();
  });

  it("Case9: ignores leading whitespace before Razor/PHP-like tokens on any line", () => {
    const on = diffLinesWithOptions("   @: <div>\n  body", "@: <div>\n\tbody", {
      ignoreLeadingFileWhitespace: true,
    });

    expect(hasLeadingDiffBeforeFirstEqual(on)).toBe(false);
    const secondLineEqual = on.find(
      (op) => op.type === "equal" && op.leftLineNo === 1 && op.rightLineNo === 1,
    );
    expect(secondLineEqual).toBeTruthy();
  });

  it("Case10: keeps inline attribute-space diff highlighting working when enabled", () => {
    const paired = pairReplace(
      diffLinesWithOptions(
        '    <div class="a  b" id="x"></div>',
        '<div class="a b" id="x"></div>',
        { ignoreLeadingFileWhitespace: true },
      ),
    );
    const replace = paired.find(
      (op) => op.type === "replace" && op.leftLineNo === 0 && op.rightLineNo === 0,
    );

    expect(replace).toBeTruthy();
    const inline = diffInlineWithAppendLiteral(replace?.leftLine ?? "", replace?.rightLine ?? "");
    const attrSpaces = extractHtmlAttributeSpaceDiffRangesPair(
      replace?.leftLine ?? "",
      replace?.rightLine ?? "",
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(attrSpaces.left.length + attrSpaces.right.length).toBeGreaterThan(0);
  });
});
