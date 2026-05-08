import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  applyTerminalPlugThemeLock,
  defineTerminalPlugTheme,
  TERMINAL_PLUG_THEME,
} from "./terminalPlugTheme";

describe("Terminal Plug theme", () => {
  it("defines a readable dark Monaco theme", () => {
    const defineTheme = vi.fn();

    defineTerminalPlugTheme({ defineTheme } as never);

    expect(defineTheme).toHaveBeenCalledWith(
      TERMINAL_PLUG_THEME,
      expect.objectContaining({
        base: "vs-dark",
        inherit: true,
        colors: expect.objectContaining({
          "editor.background": "#07100d",
          "editor.foreground": "#d7ffe7",
          "editorCursor.foreground": "#59ffa8",
          "editor.selectionBackground": "#214f3d",
        }),
      }),
    );
  });

  it("locks the public theme switch without updating stored preferences", () => {
    const dom = new JSDOM(`
      <html>
        <body>
          <label>
            <input id="theme-toggle" type="checkbox" aria-checked="false" />
          </label>
        </body>
      </html>
    `);
    const document = dom.window.document;

    document.documentElement.dataset.theme = "light";
    document.documentElement.removeAttribute("data-theme-locked");

    const toggle = applyTerminalPlugThemeLock(document);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themeLocked).toBe(TERMINAL_PLUG_THEME);
    expect(toggle?.checked).toBe(true);
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(toggle?.getAttribute("aria-disabled")).toBe("true");
  });
});
