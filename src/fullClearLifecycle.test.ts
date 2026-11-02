import { expect, it, vi } from "vitest";
import { loadMainFunctions } from "./testing/mainFunctions";
import { clearEditorModel } from "./ui/paneClear";

it("clears both models inside file-boundary guards and retains undo snapshots", () => {
  let guarded: string | null = null;
  const editor = (side: string) => ({ value: side, setValue(value: string) {
    expect(guarded).toBe(side);
    this.value = value;
  }, focus: vi.fn() });
  const leftEditor = editor("left"), rightEditor = editor("right");
  const context = {
    window: { confirm: () => true }, leftEditor, rightEditor, lastFocusedSide: "right",
    leftSegments: [1], rightSegments: [2], leftMessage: {}, rightMessage: {}, storage: {}, textStore: {},
    paneSaveTargetLists: { left: [], right: [] }, clearUndoState: null as any, anchorUndoState: {},
    captureAnchorSnapshot: () => ({ manualAnchors: [] }),
    getEditorAlternativeVersionId: () => 1,
    collectWorkspacePaneSnapshot: (side: string) => ({ text: side }), clonePaneSaveTargets: (value: unknown) => value,
    withPersistSuppressed: (action: () => void) => action(),
    withProgrammaticEdit: (side: string, action: () => void) => { guarded = side; try { action(); } finally { guarded = null; } },
    clearEditorModel,
    ...Object.fromEntries(["abortCoordinatingPaneAnchorBatch", "cancelPersist", "clearPersistedState", "clearPaneSourceState", "resetAllAnchorsAndDecorations", "updateFileCards", "resetPaneMessage", "clearPaneSummary", "updateLineNumbers", "refreshSyntaxHighlight", "recalcDiff", "setAnchorMessage", "scheduleWorkspacePersist"].map((name) => [name, vi.fn()])),
  };
  const { clearAllPanes, buildPaneClearOptions } = loadMainFunctions(["clearAllPanes", "buildPaneClearOptions"], context);
  clearAllPanes();
  expect([leftEditor.value, rightEditor.value, context.leftSegments, context.rightSegments]).toEqual(["", "", [], []]);
  expect(context.clearUndoState.left.pane.text).toBe("left");
  expect(context.clearUndoState.right.pane.text).toBe("right");
  expect(rightEditor.focus).toHaveBeenCalledOnce();
  leftEditor.value = "restored";
  const options = buildPaneClearOptions("left", { editor: leftEditor, segments: [], message: {} });
  options.clearEditor(leftEditor);
  expect(leftEditor.value).toBe("");
});
