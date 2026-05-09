import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");

describe("Terminal Plug styles", () => {
  it("scopes the hidden terminal theme to Vim plug mode", () => {
    expect(css).toContain('.app[data-vim="plug"]');
    expect(css).toContain('.app[data-vim="plug"] .toolbar');
    expect(css).toContain('.app[data-vim="plug"] .editor-pane');
    expect(css).toContain('.app[data-vim="plug"] .theme-switch');
  });

  it("keeps diff decorations visible in Vim plug mode", () => {
    expect(css).toContain("--inline-insert-bg: rgba(89, 255, 168, 0.34)");
    expect(css).toContain("--inline-delete-bg: rgba(255, 111, 102, 0.34)");
    expect(css).toContain('.app[data-vim="plug"] .monaco-editor .line-insert');
    expect(css).toContain("background-color: rgba(89, 255, 168, 0.26)");
    expect(css).toContain("background-color: rgba(255, 111, 102, 0.28)");
    expect(css).toContain("background-color: rgba(255, 204, 102, 0.3)");
  });
});
