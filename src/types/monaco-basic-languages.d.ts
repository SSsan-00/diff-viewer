declare module "monaco-editor/esm/vs/basic-languages/*" {
  export const conf: import("monaco-editor").languages.LanguageConfiguration;
  export const language: import("monaco-editor").languages.IMonarchLanguage;
}

declare module "monaco-editor/esm/vs/editor/common/core/cursorColumns.js" {
  export class CursorColumns {
    static visibleColumnFromColumn(line: string, column: number, tabSize: number): number;
  }
}
