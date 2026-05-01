import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pane title styles", () => {
  it("reserves a fixed block size for pane titles and their scrollbar gutter", () => {
    const cssPath = resolve(__dirname, "style.css");
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(/\.pane-title\s*\{[^}]*\}/s);

    expect(match).toBeTruthy();
    expect(match?.[0]).toContain("height: 56px");
    expect(match?.[0]).toContain("scrollbar-gutter: stable");
  });
});
