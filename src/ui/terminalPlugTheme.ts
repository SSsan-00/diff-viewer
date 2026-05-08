import type * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";

export const TERMINAL_PLUG_THEME = "terminal-plug";

function getThemeRoot(root: ParentNode): HTMLElement | null {
  const doc = root as Document;
  if (doc.documentElement) {
    return doc.documentElement;
  }
  if (typeof HTMLElement !== "undefined" && root instanceof HTMLElement) {
    return root;
  }
  return null;
}

export function defineTerminalPlugTheme(
  monacoEditor: typeof monaco.editor,
): void {
  monacoEditor.defineTheme(TERMINAL_PLUG_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "d7ffe7", background: "07100d" },
      { token: "comment", foreground: "6aaa85", fontStyle: "italic" },
      { token: "string", foreground: "ffcc66" },
      { token: "number", foreground: "7ad7ff" },
      { token: "keyword", foreground: "59ffa8", fontStyle: "bold" },
      { token: "type", foreground: "9dffcf" },
      { token: "function", foreground: "b8ffe0" },
      { token: "variable", foreground: "d7ffe7" },
    ],
    colors: {
      "editor.background": "#07100d",
      "editor.foreground": "#d7ffe7",
      "editorLineNumber.foreground": "#4d8267",
      "editorLineNumber.activeForeground": "#59ffa8",
      "editorCursor.foreground": "#59ffa8",
      "editor.selectionBackground": "#214f3d",
      "editor.inactiveSelectionBackground": "#173326",
      "editor.lineHighlightBackground": "#0e1b16",
      "editorGutter.background": "#07100d",
      "editorWidget.background": "#0e1b16",
      "editorWidget.border": "#2f8f61",
      "editor.findMatchBackground": "#ffcc6644",
      "editor.findMatchHighlightBackground": "#59ffa833",
      "editor.wordHighlightBackground": "#59ffa822",
      "editorIndentGuide.background1": "#173326",
      "editorIndentGuide.activeBackground1": "#59ffa8",
      "scrollbarSlider.background": "#59ffa833",
      "scrollbarSlider.hoverBackground": "#59ffa855",
      "scrollbarSlider.activeBackground": "#59ffa877",
    },
  });
}

export function applyTerminalPlugThemeLock(
  root: ParentNode = document,
): HTMLInputElement | null {
  const themeRoot = getThemeRoot(root);
  if (themeRoot) {
    themeRoot.dataset.theme = "dark";
    themeRoot.dataset.themeLocked = TERMINAL_PLUG_THEME;
  }

  const toggle = root.querySelector<HTMLInputElement>("#theme-toggle");
  if (!toggle) {
    return null;
  }

  toggle.checked = true;
  toggle.disabled = true;
  toggle.setAttribute("aria-checked", "true");
  toggle.setAttribute("aria-disabled", "true");
  toggle.title = "Terminal Plug固定";
  return toggle;
}
