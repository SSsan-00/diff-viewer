import { diffInlineWithAppendLiteral } from "./diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./htmlAttributeSpaceDiff";
import type { InlineDiff, PairedOp, Range } from "./types";

type ReplaceVisibilityOptions = {
  ignoreLeadingFileWhitespace: boolean;
  leftLeadingFileWhitespaceEligible?: boolean;
  rightLeadingFileWhitespaceEligible?: boolean;
};

export type ReplaceDisplayDiff = {
  hasVisibleDiff: boolean;
  inline: InlineDiff;
  spaceRanges: {
    left: Range[];
    right: Range[];
  };
};

export type PreparedReplaceOpsForDisplay = {
  displayDiffs: Array<ReplaceDisplayDiff | null>;
  ops: PairedOp[];
};

function buildReplaceDisplayDiff(
  leftLine: string,
  rightLine: string,
  options: ReplaceVisibilityOptions,
): ReplaceDisplayDiff {
  const inline = diffInlineWithAppendLiteral(leftLine, rightLine, options);
  const spaceRanges = extractHtmlAttributeSpaceDiffRangesPair(
    leftLine,
    rightLine,
    inline.leftRanges,
    inline.rightRanges,
  );
  return {
    hasVisibleDiff:
      inline.leftRanges.length > 0 ||
      inline.rightRanges.length > 0 ||
      spaceRanges.left.length > 0 ||
      spaceRanges.right.length > 0,
    inline,
    spaceRanges,
  };
}

export function prepareReplaceOpsForDisplay(
  ops: readonly PairedOp[],
  options: ReplaceVisibilityOptions,
): PreparedReplaceOpsForDisplay {
  const displayDiffs: Array<ReplaceDisplayDiff | null> = [];
  const normalizedOps = ops.map((op) => {
    if (op.type !== "replace" && op.type !== "equal") {
      displayDiffs.push(null);
      return op;
    }

    const leftLine = op.leftLine ?? "";
    const rightLine = op.rightLine ?? "";
    const displayDiff = buildReplaceDisplayDiff(leftLine, rightLine, options);
    displayDiffs.push(displayDiff);

    if (op.type === "equal" && displayDiff.hasVisibleDiff) {
      return {
        type: "replace",
        leftLine: op.leftLine,
        rightLine: op.rightLine,
        leftLineNo: op.leftLineNo,
        rightLineNo: op.rightLineNo,
      };
    }

    if (op.type === "replace" && displayDiff.hasVisibleDiff) {
      return op;
    }

    return {
      type: "equal",
      leftLine: op.leftLine,
      rightLine: op.rightLine,
      leftLineNo: op.leftLineNo,
      rightLineNo: op.rightLineNo,
    };
  });

  return {
    displayDiffs,
    ops: normalizedOps,
  };
}

export function normalizeReplaceOpsForDisplay(
  ops: readonly PairedOp[],
  options: ReplaceVisibilityOptions,
): PairedOp[] {
  return prepareReplaceOpsForDisplay(ops, options).ops;
}
