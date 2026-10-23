import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";
import { bindPaneClearButton, clearEditorModel, clearEditorsForUndo } from "./paneClear";
import type { LineSegment } from "../file/lineNumbering";
import type { editor } from "monaco-editor";

function setupDocument(): Document {
  return new JSDOM(APP_TEMPLATE).window.document;
}

describe("pane clear buttons", () => {
  it("clears only the left pane", () => {
    const document = setupDocument();
    const leftButton = document.querySelector<HTMLButtonElement>("#left-clear");
    const rightButton = document.querySelector<HTMLButtonElement>("#right-clear");

    const leftEditor = createEditor("left");
    const rightEditor = createEditor("right");

    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];
    const rightSegments: LineSegment[] = [
      { startLine: 1, lineCount: 3, fileIndex: 1 },
    ];

    const updateLeft = vi.fn();
    const updateRight = vi.fn();
    const afterLeft = vi.fn();
    const afterRight = vi.fn();

    bindPaneClearButton(leftButton, {
      editor: leftEditor,
      segments: leftSegments,
      updateLineNumbers: updateLeft,
      onAfterClear: afterLeft,
    });
    bindPaneClearButton(rightButton, {
      editor: rightEditor,
      segments: rightSegments,
      updateLineNumbers: updateRight,
      onAfterClear: afterRight,
    });

    leftButton?.click();

    expect(leftEditor.value).toBe("");
    expect(rightEditor.value).toBe("right");
    expect(leftSegments.length).toBe(0);
    expect(rightSegments.length).toBe(1);
    expect(updateLeft).toHaveBeenCalledTimes(1);
    expect(updateRight).not.toHaveBeenCalled();
    expect(afterLeft).toHaveBeenCalledTimes(1);
    expect(afterRight).not.toHaveBeenCalled();
  });

  it("clears only the right pane", () => {
    const document = setupDocument();
    const leftButton = document.querySelector<HTMLButtonElement>("#left-clear");
    const rightButton = document.querySelector<HTMLButtonElement>("#right-clear");

    const leftEditor = createEditor("left");
    const rightEditor = createEditor("right");

    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];
    const rightSegments: LineSegment[] = [
      { startLine: 1, lineCount: 3, fileIndex: 1 },
    ];

    const updateLeft = vi.fn();
    const updateRight = vi.fn();
    const afterLeft = vi.fn();
    const afterRight = vi.fn();

    bindPaneClearButton(leftButton, {
      editor: leftEditor,
      segments: leftSegments,
      updateLineNumbers: updateLeft,
      onAfterClear: afterLeft,
    });
    bindPaneClearButton(rightButton, {
      editor: rightEditor,
      segments: rightSegments,
      updateLineNumbers: updateRight,
      onAfterClear: afterRight,
    });

    rightButton?.click();

    expect(rightEditor.value).toBe("");
    expect(leftEditor.value).toBe("left");
    expect(rightSegments.length).toBe(0);
    expect(leftSegments.length).toBe(1);
    expect(updateRight).toHaveBeenCalledTimes(1);
    expect(updateLeft).not.toHaveBeenCalled();
    expect(afterRight).toHaveBeenCalledTimes(1);
    expect(afterLeft).not.toHaveBeenCalled();
  });

  it("clears via model edits to keep undo stack", () => {
    const editor = createEditor("filled");
    const model = editor.getModel();
    const applyEdits = vi.spyOn(model!, "applyEdits");
    const pushStackElement = vi.spyOn(model!, "pushStackElement");
    const getRange = vi.spyOn(model!, "getFullModelRange");

    clearEditorModel(editor);

    expect(getRange).toHaveBeenCalledTimes(1);
    expect(pushStackElement).toHaveBeenCalled();
    expect(applyEdits).toHaveBeenCalledWith([{ range: model!.range, text: "" }]);
    expect(editor.value).toBe("");
  });

  it("prefers editor executeEdits to preserve undo stack", () => {
    const baseEditor = createEditor("filled");
    const executeEdits = vi.fn((_source: string, edits: editor.IIdentifiedSingleEditOperation[]) => {
      const next = edits[0]?.text ?? "";
      baseEditor.value = next;
    });
    const pushUndoStop = vi.fn();
    const editor = Object.assign(baseEditor, { executeEdits, pushUndoStop });

    clearEditorModel(editor);

    expect(executeEdits).toHaveBeenCalledWith(
      "pane-clear",
      [{ range: editor.getModel()!.range, text: "" }],
      expect.any(Function),
    );
    expect(pushUndoStop).toHaveBeenCalled();
    expect(editor.value).toBe("");
  });

  it("invokes onBeforeClear before clearing", () => {
    const document = setupDocument();
    const leftButton = document.querySelector<HTMLButtonElement>("#left-clear");
    const leftEditor = createEditor("left");
    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];
    const beforeClear = vi.fn();
    const updateLeft = vi.fn();

    bindPaneClearButton(leftButton, {
      editor: leftEditor,
      segments: leftSegments,
      updateLineNumbers: updateLeft,
      onBeforeClear: beforeClear,
    });

    leftButton?.click();

    expect(beforeClear).toHaveBeenCalledTimes(1);
    expect(leftEditor.value).toBe("");
  });

  it("can route the editor clear through a caller-provided clear action", () => {
    const document = setupDocument();
    const leftButton = document.querySelector<HTMLButtonElement>("#left-clear");
    const leftEditor = createEditor("left");
    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];
    const updateLeft = vi.fn();
    const clearEditor = vi.fn((editor: typeof leftEditor) => {
      clearEditorModel(editor);
    });

    bindPaneClearButton(leftButton, {
      editor: leftEditor,
      segments: leftSegments,
      updateLineNumbers: updateLeft,
      clearEditor,
    });

    leftButton?.click();

    expect(clearEditor).toHaveBeenCalledWith(leftEditor);
    expect(leftEditor.value).toBe("");
    expect(leftSegments.length).toBe(0);
    expect(updateLeft).toHaveBeenCalledTimes(1);
  });

  it("clears multiple editors and focuses the target", () => {
    const focusLeft = vi.fn();
    const leftEditor = Object.assign(createEditor("left"), { focus: focusLeft });
    const rightEditor = createEditor("right");

    clearEditorsForUndo([leftEditor, rightEditor], leftEditor);

    expect(leftEditor.value).toBe("");
    expect(rightEditor.value).toBe("");
    expect(focusLeft).toHaveBeenCalledTimes(1);
  });
});

function createEditor(initial: string) {
  const model = {
    range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: initial.length + 1 },
    getFullModelRange() {
      return model.range;
    },
    applyEdits(edits: editor.IIdentifiedSingleEditOperation[]) {
      const next = edits[0]?.text ?? "";
      editor.value = next;
    },
    pushStackElement() {},
  };

  const editor = {
    value: initial,
    setValue(value: string) {
      editor.value = value;
    },
    getModel() {
      return model;
    },
  };

  return editor;
}
