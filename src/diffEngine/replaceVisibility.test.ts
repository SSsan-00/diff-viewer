import { describe, expect, it } from "vitest";
import type { PairedOp } from "./types";
import { normalizeReplaceOpsForDisplay } from "./replaceVisibility";

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
});
