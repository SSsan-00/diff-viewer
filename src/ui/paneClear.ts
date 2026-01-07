import type { LineSegment } from "../file/lineNumbering";

type EditorLike = {
  setValue: (value: string) => void;
};

type PaneClearOptions<Editor extends EditorLike> = {
  editor: Editor;
  segments: LineSegment[];
  updateLineNumbers: (editor: Editor, segments: LineSegment[]) => void;
  onAfterClear?: () => void;
};

export function clearPaneState<Editor extends EditorLike>(
  options: PaneClearOptions<Editor>,
): void {
  const { editor, segments, updateLineNumbers, onAfterClear } = options;
  editor.setValue("");
  segments.length = 0;
  updateLineNumbers(editor, segments);
  onAfterClear?.();
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
