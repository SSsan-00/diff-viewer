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
});
