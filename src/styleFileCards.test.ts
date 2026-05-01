import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("file card bar styles", () => {
  it("reserves a fixed block size for file cards and their scrollbar gutter", () => {
    const cssPath = resolve(__dirname, "style.css");
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(/\.file-cards-bar\s*\{[^}]*\}/s);

    expect(match).toBeTruthy();
    expect(match?.[0]).toContain("height: 30px");
    expect(match?.[0]).toContain("scrollbar-gutter: stable");
  });
});
