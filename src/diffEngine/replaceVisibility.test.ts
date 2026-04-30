import { describe, expect, it } from "vitest";
import type { PairedOp } from "./types";
import {
  normalizeReplaceOpsForDisplay,
  prepareReplaceOpsForDisplay,
} from "./replaceVisibility";

describe("normalizeReplaceOpsForDisplay", () => {
  it("downgrades identical replace rows to equal", () => {
    const ops: PairedOp[] = [
      {
        type: "replace",
        leftLine: "same();",
        rightLine: "same();",
        leftLineNo: 3,
        rightLineNo: 4,
      },
    ];

    expect(normalizeReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    })).toEqual([
      {
        type: "equal",
        leftLine: "same();",
        rightLine: "same();",
        leftLineNo: 3,
        rightLineNo: 4,
      },
    ]);
  });

  it("downgrades replace rows when only ignored leading whitespace differs", () => {
    const ops: PairedOp[] = [
      {
        type: "replace",
        leftLine: "    value = 1;",
        rightLine: "value = 1;",
        leftLineNo: 0,
        rightLineNo: 0,
      },
    ];

    expect(normalizeReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: true,
      leftLeadingFileWhitespaceEligible: true,
      rightLeadingFileWhitespaceEligible: true,
    })[0]?.type).toBe("equal");
  });

  it("keeps replace rows when visible inline differences remain", () => {
    const ops: PairedOp[] = [
      {
        type: "replace",
        leftLine: "$wbook->close;",
        rightLine: "wbook.close();",
        leftLineNo: 10,
        rightLineNo: 10,
      },
    ];

    expect(normalizeReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    })[0]?.type).toBe("replace");
  });

  it("upgrades aligned equal rows to replace when raw lines have visible inline differences", () => {
    const ops: PairedOp[] = [
      {
        type: "equal",
        leftLine: "$wbook->close;",
        rightLine: "wbook.close();",
        leftLineNo: 10,
        rightLineNo: 10,
      },
    ];

    expect(normalizeReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    })[0]).toEqual({
      type: "replace",
      leftLine: "$wbook->close;",
      rightLine: "wbook.close();",
      leftLineNo: 10,
      rightLineNo: 10,
    });
  });

  it("keeps aligned equal rows equal when only ignored leading whitespace differs", () => {
    const ops: PairedOp[] = [
      {
        type: "equal",
        leftLine: "    value = 1;",
        rightLine: "value = 1;",
        leftLineNo: 0,
        rightLineNo: 0,
      },
    ];

    expect(normalizeReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: true,
      leftLeadingFileWhitespaceEligible: true,
      rightLeadingFileWhitespaceEligible: true,
    })[0]?.type).toBe("equal");
  });

  it("upgrades AppendLine-aligned rows so wrapper differences are highlighted without anchors", () => {
    const ops: PairedOp[] = [
      {
        type: "equal",
        leftLine: "<head>",
        rightLine: "sb.AppendLine(\"<head>\");",
        leftLineNo: 2,
        rightLineNo: 8,
      },
    ];

    expect(normalizeReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    })[0]?.type).toBe("replace");
  });

  it("returns reusable inline display data alongside normalized ops", () => {
    const ops: PairedOp[] = [
      {
        type: "replace",
        leftLine: "<head>",
        rightLine: "sb.AppendLine(\"<head>\");",
        leftLineNo: 2,
        rightLineNo: 8,
      },
    ];

    const prepared = prepareReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    });

    expect(prepared.ops[0]?.type).toBe("replace");
    expect(prepared.displayDiffs).toHaveLength(1);
    expect(prepared.displayDiffs[0]?.hasVisibleDiff).toBe(true);
    expect(prepared.displayDiffs[0]?.inline.rightRanges.length).toBeGreaterThan(0);
  });
});
