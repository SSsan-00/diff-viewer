import type { LineSegment } from "../file/lineNumbering";
import type { editor, IRange, Selection } from "monaco-editor";

type EditorLike = {
  setValue: (value: string) => void;
  focus?: () => void;
  executeEdits?: (
    source: string,
    edits: editor.IIdentifiedSingleEditOperation[],
    endCursorState?: editor.ICursorStateComputer | Selection[],
  ) => void;
  pushUndoStop?: () => void;
  getModel?: () => {
    getFullModelRange?: () => IRange;
    applyEdits?: (edits: editor.IIdentifiedSingleEditOperation[]) => void;
    pushEditOperations?: (
      beforeCursorState: Selection[],
      edits: editor.IIdentifiedSingleEditOperation[],
      cursorStateComputer: editor.ICursorStateComputer,
    ) => void;
    pushStackElement?: () => void;
  } | null;
};

type PaneClearOptions<Editor extends EditorLike> = {
  editor: Editor;
  segments: LineSegment[];
  updateLineNumbers: (editor: Editor, segments: LineSegment[]) => void;
  clearEditor?: (editor: Editor) => void;
  onBeforeClear?: () => void;
  onAfterClear?: () => void;
};

export function clearPaneState<Editor extends EditorLike>(
  options: PaneClearOptions<Editor>,
): void {
  const {
    editor,
    segments,
    updateLineNumbers,
    clearEditor = clearEditorModel,
    onBeforeClear,
    onAfterClear,
  } = options;
  onBeforeClear?.();
  clearEditor(editor);
  segments.length = 0;
  updateLineNumbers(editor, segments);
  onAfterClear?.();
  editor.focus?.();
}

export function clearEditorModel(editor: EditorLike): void {
  const model = editor.getModel?.();
  if (!model || !model.getFullModelRange) {
    editor.setValue("");
    return;
  }
  const range = model.getFullModelRange();
  if (editor.executeEdits) {
    editor.pushUndoStop?.();
    editor.executeEdits("pane-clear", [{ range, text: "" }], () => null);
    editor.pushUndoStop?.();
    return;
  }
  model.pushStackElement?.();
  if (model.applyEdits) {
    model.applyEdits([{ range, text: "" }]);
  } else if (model.pushEditOperations) {
    model.pushEditOperations([], [{ range, text: "" }], () => null);
  } else {
    editor.setValue("");
  }
  model.pushStackElement?.();
}

export function clearEditorsForUndo<Editor extends EditorLike>(
  editors: Editor[],
  focusEditor?: Editor,
): void {
  editors.forEach((editor) => {
    clearEditorModel(editor);
  });
  focusEditor?.focus?.();
}

export function bindPaneClearButton<Editor extends EditorLike>(
  button: HTMLButtonElement | null,
  options: PaneClearOptions<Editor>,
): void {
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    clearPaneState(options);
  });
}
