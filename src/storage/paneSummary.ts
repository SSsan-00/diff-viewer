type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PANE_SUMMARY_KEY_PREFIX = "diff-viewer:paneMessageSummary:v1";

export type PaneSide = "left" | "right";

function getPaneSummaryKey(side: PaneSide): string {
  return `${PANE_SUMMARY_KEY_PREFIX}:${side}`;
}

export function clearPaneSummary(
  storage: StorageLike | null,
  side: PaneSide,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(getPaneSummaryKey(side));
  } catch (error) {
    console.warn("Failed to clear pane summary:", error);
  }
}
