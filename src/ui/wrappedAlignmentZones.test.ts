import { describe, expect, it } from "vitest";
import { buildWrappedAlignmentZones } from "./wrappedAlignmentZones";
import type { PairedOp } from "../diffEngine/types";

function makeEditor(heights: number[]) {
  const tops = [0];
  heights.forEach((height) => tops.push((tops.at(-1) ?? 0) + height));
  return {
    getModel: () => ({ getLineCount: () => heights.length }),
    getTopForLineNumber: (lineNumber: number) => tops[lineNumber - 1] ?? 0,
    getBottomForLineNumber: (lineNumber: number) => tops[lineNumber] ?? 0,
  };
}

describe("buildWrappedAlignmentZones", () => {
  it("compensates matched rows using their actual wrapped pixel heights", () => {
    const ops: PairedOp[] = [
      {
        type: "equal",
        leftLine: "short",
        rightLine: "wrapped",
        leftLineNo: 0,
        rightLineNo: 0,
      },
      {
        type: "replace",
        leftLine: "wrapped",
        rightLine: "short",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ];

    expect(
      buildWrappedAlignmentZones(ops, makeEditor([20, 60]), makeEditor([60, 20])),
    ).toEqual({
      left: [{ afterLineNumber: 1, heightInPx: 40, className: "diff-zone-wrap" }],
      right: [{ afterLineNumber: 2, heightInPx: 40, className: "diff-zone-wrap" }],
    });
  });

  it("uses the inserted or deleted row's wrapped height for gap zones", () => {
    const ops: PairedOp[] = [
      { type: "insert", rightLine: "wrapped insert", rightLineNo: 0 },
      { type: "delete", leftLine: "wrapped delete", leftLineNo: 0 },
    ];

    expect(
      buildWrappedAlignmentZones(ops, makeEditor([60]), makeEditor([40])),
    ).toEqual({
      left: [{ afterLineNumber: 0, heightInPx: 40, className: "diff-zone-insert" }],
      right: [{ afterLineNumber: 1, heightInPx: 60, className: "diff-zone-delete" }],
    });
  });
});
