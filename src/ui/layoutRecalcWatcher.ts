import { isFindWidgetVisible } from "./findWidgetOffset";

export type LayoutAwareEditor = {
  onDidLayoutChange: (handler: () => void) => void;
  onDidContentSizeChange: (handler: () => void) => void;
  getLayoutInfo: () => { width: number; height: number; contentTop?: number };
  getContentHeight: () => number;
  getModel: () => { getLineCount: () => number } | null;
  getDomNode?: () => HTMLElement | null;
};

type LayoutKey = {
  width: number;
  height: number;
  contentHeight: number;
  lineCount: number;
  findWidgetVisible: boolean;
  contentTop: number;
};

const toKey = (
  editor: LayoutAwareEditor,
): LayoutKey => {
  const layout = editor.getLayoutInfo();
  const model = editor.getModel();
  const domNode = editor.getDomNode ? editor.getDomNode() : null;
  return {
    width: layout.width,
    height: layout.height,
    contentHeight: editor.getContentHeight(),
    lineCount: model ? model.getLineCount() : 0,
    findWidgetVisible: isFindWidgetVisible(domNode),
    contentTop: typeof layout.contentTop === "number" ? layout.contentTop : 0,
  };
};

const keyEquals = (left: LayoutKey, right: LayoutKey): boolean =>
  left.width === right.width &&
  left.height === right.height &&
  left.contentHeight === right.contentHeight &&
  left.lineCount === right.lineCount &&
  left.findWidgetVisible === right.findWidgetVisible &&
  left.contentTop === right.contentTop;

export function bindEditorLayoutRecalc(
  editors: LayoutAwareEditor[],
  scheduleRecalc: () => void,
): void {
  const lastKeys = new WeakMap<LayoutAwareEditor, LayoutKey>();

  const handleChange = (editor: LayoutAwareEditor) => {
    const nextKey = toKey(editor);
    const prevKey = lastKeys.get(editor);
    if (prevKey && keyEquals(prevKey, nextKey)) {
      return;
    }
    lastKeys.set(editor, nextKey);
    scheduleRecalc();
  };

  editors.forEach((editor) => {
    editor.onDidLayoutChange(() => handleChange(editor));
    editor.onDidContentSizeChange(() => handleChange(editor));
  });
}
