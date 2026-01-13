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
    expect(rootMatch?.[0]).toContain("--inline-insert-outline:");
    expect(rootMatch?.[0]).toContain("--inline-delete-outline:");
    expect(rootMatch?.[0]).toContain("--anchor-auto-fg:");
    expect(rootMatch?.[0]).toContain("--file-badge-1-bg:");
    expect(rootMatch?.[0]).toContain("--file-badge-4-fg:");

    expect(darkMatch?.[0]).toContain("--inline-insert-bg:");
    expect(darkMatch?.[0]).toContain("--inline-delete-bg:");
    expect(darkMatch?.[0]).toContain("--inline-insert-outline:");
    expect(darkMatch?.[0]).toContain("--inline-delete-outline:");
    expect(darkMatch?.[0]).toContain("--anchor-auto-fg:");
    expect(darkMatch?.[0]).toContain("--file-badge-1-bg:");
    expect(darkMatch?.[0]).toContain("--file-badge-4-fg:");
  });

  it("applies theme tokens to inline diff and auto anchor elements", () => {
    const css = loadCss();
    const inlineInsert = css.match(/\.monaco-editor\s+\.inline-insert\s*\{[^}]*\}/s);
    const inlineDelete = css.match(/\.monaco-editor\s+\.inline-delete\s*\{[^}]*\}/s);
    const anchorAuto = css.match(/\.anchor-link\.anchor-auto\s*\{[^}]*\}/s);
    const fileBadge = css.match(/\.anchor-file-badge\s*\{[^}]*\}/s);
    const inlineReadable = css.match(
      /\[data-theme="dark"\]\[data-highlight="on"\][\s\S]*?\.inline-insert/s,
    );

    expect(inlineInsert).toBeTruthy();
    expect(inlineDelete).toBeTruthy();
    expect(anchorAuto).toBeTruthy();
    expect(fileBadge).toBeTruthy();
    expect(inlineReadable).toBeTruthy();

    expect(inlineInsert?.[0]).toContain("var(--inline-insert-bg)");
    expect(inlineDelete?.[0]).toContain("var(--inline-delete-bg)");
    expect(anchorAuto?.[0]).toContain("var(--anchor-auto-fg)");
    expect(fileBadge?.[0]).toContain("var(--file-badge-1-bg)");
  });

  it("includes reduced-motion styles for the theme switch", () => {
    const css = loadCss();
    const reducedMotion = css.match(/prefers-reduced-motion:\s*reduce[\s\S]*?\}/s);

    expect(reducedMotion).toBeTruthy();
    expect(reducedMotion?.[0]).toContain(".theme-switch__thumb");
    expect(reducedMotion?.[0]).toContain(".theme-switch__track");
  });
});
