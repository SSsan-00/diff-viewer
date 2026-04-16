import { diffInlineWithAppendLiteral } from "./diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./htmlAttributeSpaceDiff";
import type { PairedOp } from "./types";

type ReplaceVisibilityOptions = {
  ignoreLeadingFileWhitespace: boolean;
  leftLeadingFileWhitespaceEligible?: boolean;
  rightLeadingFileWhitespaceEligible?: boolean;
};

export function normalizeReplaceOpsForDisplay(
  ops: readonly PairedOp[],
  options: ReplaceVisibilityOptions,
): PairedOp[] {
  return ops.map((op) => {
    if (op.type !== "replace") {
      return op;
    }

    const leftLine = op.leftLine ?? "";
    const rightLine = op.rightLine ?? "";
    const inline = diffInlineWithAppendLiteral(leftLine, rightLine, options);
    const spaceRanges = extractHtmlAttributeSpaceDiffRangesPair(
      leftLine,
      rightLine,
      inline.leftRanges,
      inline.rightRanges,
    );
    const hasVisibleDiff =
      inline.leftRanges.length > 0 ||
      inline.rightRanges.length > 0 ||
      spaceRanges.left.length > 0 ||
      spaceRanges.right.length > 0;

    if (hasVisibleDiff) {
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
}
