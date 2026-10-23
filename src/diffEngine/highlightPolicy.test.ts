import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchors";
import type { PairedOp } from "./types";
import { buildManualAnchorHighlightKeys, shouldShowDiffHighlight } from "./highlightPolicy";

describe("shouldShowDiffHighlight", () => {
  const manualAnchors: readonly Anchor[] = [{ leftLineNo: 2, rightLineNo: 4 }];

  it("allows all visible diff rows in normal mode", () => {
    const op: PairedOp = {
      type: "replace",
      leftLineNo: 10,
      rightLineNo: 12,
    };

    expect(shouldShowDiffHighlight(op, "normal", manualAnchors)).toBe(true);
  });

  it("suppresses non-anchor diff rows in manual-anchor-only mode", () => {
    const op: PairedOp = {
      type: "replace",
      leftLineNo: 10,
      rightLineNo: 12,
    };

    expect(shouldShowDiffHighlight(op, "manual-anchor-only", manualAnchors)).toBe(
      false,
    );
  });

  it("allows manually anchored diff rows in manual-anchor-only mode", () => {
    const op: PairedOp = {
      type: "replace",
      leftLineNo: 2,
      rightLineNo: 4,
    };

    expect(shouldShowDiffHighlight(op, "manual-anchor-only", manualAnchors)).toBe(
      true,
    );
  });

  it("does not highlight alignment-only rows", () => {
    const op: PairedOp = {
      type: "insert",
      diffVisible: false,
      rightLineNo: 4,
    };

    expect(shouldShowDiffHighlight(op, "normal", manualAnchors)).toBe(false);
    expect(shouldShowDiffHighlight(op, "manual-anchor-only", manualAnchors)).toBe(
      false,
    );
  });

  it("accepts precomputed readonly anchor keys as well as anchor arrays", () => {
    const keys = buildManualAnchorHighlightKeys(manualAnchors);
    expect(shouldShowDiffHighlight({
      type: "replace", leftLineNo: 2, rightLineNo: 4,
    }, "manual-anchor-only", keys)).toBe(true);
    expect(shouldShowDiffHighlight({
      type: "replace", leftLineNo: 2, rightLineNo: 5,
    }, "manual-anchor-only", keys)).toBe(false);
  });
});
