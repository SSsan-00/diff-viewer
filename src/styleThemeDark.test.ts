import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadCss(): string {
  return readFileSync(resolve(__dirname, "style.css"), "utf8");
}

describe("dark theme readability tokens", () => {
  it("defines inline diff and auto anchor tokens for light and dark themes", () => {
    const css = loadCss();
    const rootMatch = css.match(/:root\s*\{[^}]*\}/s);
    const darkMatch = css.match(/\[data-theme="dark"\]\s*\{[^}]*\}/s);

    expect(rootMatch).toBeTruthy();
    expect(darkMatch).toBeTruthy();

    expect(rootMatch?.[0]).toContain("--inline-insert-bg:");
    expect(rootMatch?.[0]).toContain("--inline-delete-bg:");
    expect(rootMatch?.[0]).toContain("--anchor-auto-fg:");

    expect(darkMatch?.[0]).toContain("--inline-insert-bg:");
    expect(darkMatch?.[0]).toContain("--inline-delete-bg:");
    expect(darkMatch?.[0]).toContain("--anchor-auto-fg:");
  });

  it("applies theme tokens to inline diff and auto anchor elements", () => {
    const css = loadCss();
    const inlineInsert = css.match(/\.monaco-editor\s+\.inline-insert\s*\{[^}]*\}/s);
    const inlineDelete = css.match(/\.monaco-editor\s+\.inline-delete\s*\{[^}]*\}/s);
    const anchorAuto = css.match(/\.anchor-link\.anchor-auto\s*\{[^}]*\}/s);

    expect(inlineInsert).toBeTruthy();
    expect(inlineDelete).toBeTruthy();
    expect(anchorAuto).toBeTruthy();

    expect(inlineInsert?.[0]).toContain("var(--inline-insert-bg)");
    expect(inlineDelete?.[0]).toContain("var(--inline-delete-bg)");
    expect(anchorAuto?.[0]).toContain("var(--anchor-auto-fg)");
  });
});
