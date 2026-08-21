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

  it("keeps non-visible alignment rows equal even when text differs", () => {
    const ops: PairedOp[] = [
      {
        type: "equal",
        diffVisible: false,
        leftLine: "left changed",
        rightLine: "right changed",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ];

    const prepared = prepareReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    });

    expect(prepared.ops).toEqual(ops);
    expect(prepared.displayDiffs).toEqual([null]);
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

  it("keeps identical AppendLine rows equal without wrapper-only highlights", () => {
    const line = '        sb.AppendLine("      const qty = safeParseInt(formData.qty, NaN);");';
    const ops: PairedOp[] = [
      {
        type: "equal",
        leftLine: line,
        rightLine: line,
        leftLineNo: 4,
        rightLineNo: 4,
      },
    ];

    const prepared = prepareReplaceOpsForDisplay(ops, {
      ignoreLeadingFileWhitespace: false,
    });

    expect(prepared.ops[0]?.type).toBe("equal");
    expect(prepared.displayDiffs[0]?.hasVisibleDiff).toBe(false);
    expect(prepared.displayDiffs[0]?.inline).toEqual({
      leftRanges: [],
      rightRanges: [],
    });
  });

  it("keeps interpolated AppendLine expression changes as replace rows", () => {
    const leftLine = 'sb.AppendLine($"<b>{foo}</b>");';
    const rightLine = 'sb.AppendLine($"<b>{bar}</b>");';
    const prepared = prepareReplaceOpsForDisplay([
      {
        type: "replace",
        leftLine,
        rightLine,
        leftLineNo: 2,
        rightLineNo: 2,
      },
    ], {
      ignoreLeadingFileWhitespace: false,
    });

    expect(prepared.ops[0]?.type).toBe("replace");
    expect(prepared.displayDiffs[0]?.hasVisibleDiff).toBe(true);
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
