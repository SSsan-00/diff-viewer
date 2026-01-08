import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

function extractStyleContents(html: string): string[] {
  const matches = html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  const results: string[] = [];
  for (const match of matches) {
    results.push(match[1] ?? "");
  }
  return results;
}

function normalizeCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
}

describe("dist readable style", () => {
  it("keeps readable CSS aligned with minified output", () => {
    const readablePath = resolve(process.cwd(), "dist", "index.html");
    const minifiedPath = resolve(process.cwd(), "dist", "index.min.html");
    const readableContent = readFileSync(readablePath, "utf8");
    const minifiedContent = readFileSync(minifiedPath, "utf8");
    const readableStyles = extractStyleContents(readableContent).map(normalizeCss);
    const minifiedStyles = extractStyleContents(minifiedContent).map(normalizeCss);

    expect(readableStyles.length).toBeGreaterThan(0);
    expect(readableStyles).toHaveLength(minifiedStyles.length);
    expect(readableStyles).toEqual(minifiedStyles);
  });

  it("keeps data URLs intact in readable CSS", () => {
    const distPath = resolve(process.cwd(), "dist", "index.html");
    const content = readFileSync(distPath, "utf8");
    const styles = extractStyleContents(content);

    const hasBrokenDataUrl = styles.some((styleText) =>
      /data:[^)]*;\s+base64/i.test(styleText),
    );

    expect(hasBrokenDataUrl).toBe(false);
  });
});
