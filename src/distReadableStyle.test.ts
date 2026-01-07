import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function extractStyleContents(html: string): string[] {
  const matches = html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  const results: string[] = [];
  for (const match of matches) {
    results.push(match[1] ?? "");
  }
  return results;
}

describe("dist readable style", () => {
  it("ensures dist/index.html has multiline <style> content", () => {
    const distPath = resolve(process.cwd(), "dist", "index.html");
    const content = readFileSync(distPath, "utf8");
    const styles = extractStyleContents(content);

    expect(styles.length).toBeGreaterThan(0);

    const hasMultiline = styles.some((styleText) => styleText.includes("\n"));
    expect(hasMultiline).toBe(true);
  });

  it("keeps data URLs intact when formatting readable CSS", () => {
    const distPath = resolve(process.cwd(), "dist", "index.html");
    const content = readFileSync(distPath, "utf8");
    const styles = extractStyleContents(content);

    const hasBrokenDataUrl = styles.some((styleText) =>
      /data:[^)]*;\s+base64/i.test(styleText),
    );

    expect(hasBrokenDataUrl).toBe(false);
  });
});
