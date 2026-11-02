import { expect, it, vi } from "vitest";
import { loadMainFunctions } from "./testing/mainFunctions";
import { runWorkspaceSwitch } from "./ui/workspaceSwitchFlow";

it("switches workspace content and restores handles without deleting saved targets", () => {
  const stored = new Map([["old", "old-handle"], ["next", "next-handle"]]);
  const clearPaneSaveTarget = vi.fn((_side, options) => { if (options.persist !== false) stored.clear(); });
  const restorePaneSaveTargetsForWorkspace = vi.fn();
  const editors = () => { let text = "old"; return { getValue: () => text, setValue: (value: string) => { text = value; } }; };
  const anchors = { manualAnchors: [], autoAnchor: null, pendingLeftLineNo: null, pendingRightLineNo: null, selectedAnchorKey: null, suppressedAutoAnchorKey: null };
  const context = {
    workspaceState: { selectedId: "old", workspaces: ["old", "next"].map((id) => ({ id, name: id, leftText: id, rightText: id, anchors })) },
    storage: {}, textStore: {}, leftEditor: editors(), rightEditor: editors(), leftMessage: {}, rightMessage: {},
    anchorUndoState: {}, runWorkspaceSwitch,
    withProgrammaticEdit: (_side: string, action: () => void) => action(),
    setWorkspacePaneState: (_storage: unknown, state: unknown) => ({ ok: true, state }),
    collectWorkspacePaneSnapshot: () => ({}), getCurrentAnchorState: () => anchors, getWorkspacePaneSnapshot: () => ({}),
    clearPaneSaveTarget, restorePaneSaveTargetsForWorkspace,
    ...Object.fromEntries(["abortCoordinatingPaneAnchorBatch", "applyWorkspacePaneSnapshot", "refreshSyntaxHighlight", "resetPaneMessage", "clearPaneSummary", "applyWorkspaceAnchors", "schedulePersist", "saveWorkspaces", "renderWorkspacePanel", "loadFavoriteListsForWorkspace", "scheduleWorkspacePersist", "clearPaneRawFiles", "commitPaneBoundarySnapshot"].map((name) => [name, vi.fn()])),
    recalcScheduler: { runNow: vi.fn() },
  };
  const functions = loadMainFunctions(["clearPaneSourceState", "clearPaneSourceStateForWorkspaceRestore", "switchWorkspaceById"], context);
  functions.switchWorkspaceById("next");
  expect(context.workspaceState.selectedId).toBe("next");
  expect([context.leftEditor.getValue(), context.rightEditor.getValue()]).toEqual(["next", "next"]);
  expect(clearPaneSaveTarget.mock.calls).toEqual([["left", { persist: false }], ["right", { persist: false }]]);
  expect([...stored.values()]).toEqual(["old-handle", "next-handle"]);
  expect(restorePaneSaveTargetsForWorkspace).toHaveBeenCalledWith("next");
});
