import { describe, it, expect } from "vitest";
import { diffLinesFromLines } from "./diffLines";
import { diffWithAnchors, type Anchor } from "./anchors";
import type { LineOp } from "./types";

function getEqualLines(ops: LineOp[]): Array<{ left: string; right: string }> {
  return ops
    .filter((op) => op.type === "equal")
    .map((op) => ({ left: op.leftLine ?? "", right: op.rightLine ?? "" }));
}

describe("diff alignment for large shifts", () => {
  it("aligns a common block after a large insert/delete", () => {
    const common = Array.from({ length: 12 }, (_, i) => `COMMON-${i}`);
    const left = ["HEAD", ...Array.from({ length: 20 }, (_, i) => `L-${i}`), ...common, "TAIL"];
    const right = ["HEAD", ...Array.from({ length: 18 }, (_, i) => `R-${i}`), ...common, "TAIL"];

    const ops = diffLinesFromLines(left, right);
    const equals = getEqualLines(ops).map((pair) => pair.left);

    const start = equals.indexOf("COMMON-0");
    const end = equals.indexOf("COMMON-11");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it("prefers unique lines when duplicates are abundant", () => {
    const left = ["A", "DUP", "DUP", "DUP", "UNIQ", "TAIL"];
    const right = ["A", "DUP", "UNIQ", "DUP", "DUP", "TAIL"];

    const ops = diffLinesFromLines(left, right);
    const equals = getEqualLines(ops).map((pair) => pair.left);

    expect(equals).toContain("UNIQ");
  });
});

describe("diff alignment with anchors", () => {
  it("keeps the anchor boundary intact", () => {
    const left = ["TOP", "A", "A", "ANCHOR", "L1", "L2"];
    const right = ["TOP", "A", "ANCHOR", "R1", "R2"];
    const anchors: Anchor[] = [{ leftLineNo: 3, rightLineNo: 2 }];

    const ops = diffWithAnchors(left.join("\n"), right.join("\n"), anchors);
    const anchorOp = ops.find(
      (op) => op.type === "equal" && op.leftLine === "ANCHOR" && op.rightLine === "ANCHOR",
    );

    expect(anchorOp).toBeDefined();
  });
});
