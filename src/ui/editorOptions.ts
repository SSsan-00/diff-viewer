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
    lineNumbers: "on",
    stickyScroll: { enabled: false },
  };
}
