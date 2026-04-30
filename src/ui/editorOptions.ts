import type { editor } from "monaco-editor";

export function createEditorOptions(
  value: string,
): editor.IStandaloneEditorConstructionOptions {
  return {
    value,
    language: "plaintext",
    theme: "vs",
    automaticLayout: true,
    lineHeight: 22,
    wordWrap: "off",
    wrappingStrategy: "advanced",
    glyphMargin: true,
    minimap: { enabled: false },
    scrollbar: {
      horizontal: "visible",
      horizontalScrollbarSize: 12,
      verticalScrollbarSize: 12,
      alwaysConsumeMouseWheel: false,
    },
    lineNumbers: "on",
    stickyScroll: { enabled: false },
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
  };
}
