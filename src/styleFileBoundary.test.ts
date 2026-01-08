import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("file boundary zone styles", () => {
  it("does not force file names to uppercase", () => {
    const cssPath = resolve(__dirname, "style.css");
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(/\.file-boundary-zone\s*\{[^}]*\}/s);
    expect(match).toBeTruthy();
    expect(match?.[0]).toContain("text-transform: none");
  });
});
