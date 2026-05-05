import type { Anchor } from "./anchors";
import type { PairedOp } from "./types";

export type DiffHighlightMode = "normal" | "manual-anchor-only";

function anchorKey(leftLineNo: number | undefined, rightLineNo: number | undefined): string {
  return `${leftLineNo ?? ""}:${rightLineNo ?? ""}`;
}

export function buildManualAnchorHighlightKeys(
  manualAnchors: readonly Anchor[],
): ReadonlySet<string> {
  return new Set(
    manualAnchors.map((anchor) => anchorKey(anchor.leftLineNo, anchor.rightLineNo)),
  );
}

export function shouldShowDiffHighlight(
  op: PairedOp,
  mode: DiffHighlightMode,
  manualAnchorKeysOrAnchors: ReadonlySet<string> | readonly Anchor[],
): boolean {
  if (op.type === "equal" || op.diffVisible === false) {
    return false;
  }
  if (mode === "normal") {
    return true;
  }
  const manualAnchorKeys = Array.isArray(manualAnchorKeysOrAnchors)
    ? buildManualAnchorHighlightKeys(manualAnchorKeysOrAnchors)
    : manualAnchorKeysOrAnchors;
  return manualAnchorKeys.has(anchorKey(op.leftLineNo, op.rightLineNo));
}
