import { describe, expect, it } from "vitest";
import { getDiffBlockStarts } from "../diffEngine/diffBlocks";
import { diffLinesFromLines } from "../diffEngine/diffLines";
import { pairReplace } from "../diffEngine/pairReplace";
import type { PairedOp } from "../diffEngine/types";
import { buildCopyVisualRowsFromAlignedDiff } from "./paneSourceCopy";

function buildDisplayOps(leftLines: string[], rightLines: string[]): PairedOp[] {
  return pairReplace(diffLinesFromLines(leftLines, rightLines));
}

function projectLeftLines(ops: PairedOp[]): string[] {
  return ops
    .filter((op) => op.type !== "insert")
    .map((op) => op.leftLine ?? "");
}

function projectRightLines(ops: PairedOp[]): string[] {
  return ops
    .filter((op) => op.type !== "delete")
    .map((op) => op.rightLine ?? "");
}

function expectDiffVisible(options: {
  leftLines: string[];
  rightLines: string[];
  leftMarkers?: string[];
  rightMarkers?: string[];
}): void {
  const { leftLines, rightLines, leftMarkers = [], rightMarkers = [] } = options;
  const ops = buildDisplayOps(leftLines, rightLines);
  const diffBlockStarts = getDiffBlockStarts(ops);
  const visualRows = buildCopyVisualRowsFromAlignedDiff(ops);

  expect(projectLeftLines(ops)).toEqual(leftLines);
  expect(projectRightLines(ops)).toEqual(rightLines);
  expect(diffBlockStarts.length).toBeGreaterThan(0);
  expect(diffBlockStarts.every((rowIndex) => ops[rowIndex]?.type !== "equal")).toBe(true);
  expect(visualRows).toHaveLength(ops.length);

  leftMarkers.forEach((marker) => {
    expect(visualRows.some((row) => row.leftText === marker)).toBe(true);
  });
  rightMarkers.forEach((marker) => {
    expect(visualRows.some((row) => row.rightText === marker)).toBe(true);
  });
}

describe("diff visibility invariants", () => {
  it("keeps visible diff blocks for replacements, insertions, and deletions", () => {
    [
      {
        leftLines: ["same-0", "left-replaced", "same-1"],
        rightLines: ["same-0", "right-replaced", "same-1"],
        leftMarkers: ["left-replaced"],
        rightMarkers: ["right-replaced"],
      },
      {
        leftLines: ["same-0", "same-1"],
        rightLines: ["right-inserted", "same-0", "same-1"],
        rightMarkers: ["right-inserted"],
      },
      {
        leftLines: ["same-0", "same-1", "left-deleted"],
        rightLines: ["same-0", "same-1"],
        leftMarkers: ["left-deleted"],
      },
      {
        leftLines: [
          "HEADER",
          ...Array.from({ length: 120 }, (_, index) => `repeat-${index % 11}`),
          "left-sentinel",
          ...Array.from({ length: 80 }, (_, index) => `tail-${index % 7}`),
          "FOOTER",
        ],
        rightLines: [
          "HEADER",
          ...Array.from({ length: 60 }, (_, index) => `repeat-${index % 11}`),
          "right-sentinel",
          ...Array.from({ length: 140 }, (_, index) => `tail-${index % 7}`),
          "FOOTER",
        ],
        leftMarkers: ["left-sentinel"],
        rightMarkers: ["right-sentinel"],
      },
    ].forEach((scenario) => expectDiffVisible(scenario));
  });

  it("keeps isolated 30000-line changes visible", () => {
    const lineCount = 30_000;
    const middle = Math.floor(lineCount / 2);
    const base = Array.from({ length: lineCount }, (_, index) => `line-${index}`);

    const replacedLeft = [...base];
    const replacedRight = [...base];
    replacedLeft[middle] = "left-replaced-30000";
    replacedRight[middle] = "right-replaced-30000";
    expectDiffVisible({
      leftLines: replacedLeft,
      rightLines: replacedRight,
      leftMarkers: ["left-replaced-30000"],
      rightMarkers: ["right-replaced-30000"],
    });

    expectDiffVisible({
      leftLines: base,
      rightLines: [
        ...base.slice(0, middle),
        "right-inserted-30000",
        ...base.slice(middle),
      ],
      rightMarkers: ["right-inserted-30000"],
    });

    expectDiffVisible({
      leftLines: [
        ...base.slice(0, middle),
        "left-deleted-30000",
        ...base.slice(middle),
      ],
      rightLines: base,
      leftMarkers: ["left-deleted-30000"],
    });
  });

  it("keeps an isolated 100000-line replacement visible", () => {
    const lineCount = 100_000;
    const middle = Math.floor(lineCount / 2);
    const leftLines = Array.from({ length: lineCount }, (_, index) => `line-${index}`);
    const rightLines = [...leftLines];

    leftLines[middle] = "left-replaced-100000";
    rightLines[middle] = "right-replaced-100000";

    expectDiffVisible({
      leftLines,
      rightLines,
      leftMarkers: ["left-replaced-100000"],
      rightMarkers: ["right-replaced-100000"],
    });
  });
});
