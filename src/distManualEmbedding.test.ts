import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const distFiles = [
  resolve(process.cwd(), "dist", "index.html"),
  resolve(process.cwd(), "dist", "index.min.html"),
];

function getManualHtmlSource(content: string): string | null {
  const match = content.match(
    /<script\b(?=[^>]*id="manual-html-source")[^>]*>([\s\S]*?)<\/script>/,
  );
  return match?.[1] ?? null;
}

describe("dist manual embedding", () => {
  for (const filePath of distFiles) {
    it(`embeds MANUAL.html into the inert manual source in ${filePath}`, () => {
      const content = readFileSync(filePath, "utf8");
      const manualSource = getManualHtmlSource(content);

      expect(manualSource).toBeTruthy();
      expect(manualSource).toContain("diff-viewer 操作マニュアル");
      expect(manualSource).not.toContain("__DIFF_VIEWER_MANUAL_HTML__");
    });
  }
});
