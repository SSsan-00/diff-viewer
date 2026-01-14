type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PANE_SUMMARY_KEY_PREFIX = "diff-viewer:paneMessageSummary:v1";

export type PaneSide = "left" | "right";

function getPaneSummaryKey(side: PaneSide): string {
  return `${PANE_SUMMARY_KEY_PREFIX}:${side}`;
}

export function loadPaneSummary(
  storage: StorageLike | null,
  side: PaneSide,
): string | null {
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(getPaneSummaryKey(side));
  } catch (error) {
    console.warn("Failed to read pane summary:", error);
    return null;
  }
}

export function savePaneSummary(
  storage: StorageLike | null,
  side: PaneSide,
  message: string,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(getPaneSummaryKey(side), message);
  } catch (error) {
    console.warn("Failed to save pane summary:", error);
  }
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
