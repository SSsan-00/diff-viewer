import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const distFiles = [
  resolve(process.cwd(), "dist", "index.html"),
  resolve(process.cwd(), "dist", "index.min.html"),
];

const forbiddenStrings = [
  "http://",
  "https://",
  "GITHUB_WORKSPACE",
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
];

const forbiddenRegexes = [
  /sourceMappingURL=/,
  /data:application\/json[^,]*;base64,/,
];

const weakForbiddenRegexes = [/\bgithub\b/i, /\bapi\b/i];

function stripScriptAndStyle(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

describe("dist gate", () => {
  for (const filePath of distFiles) {
    it(`blocks forbidden strings in ${filePath}`, () => {
      const content = readFileSync(filePath, "utf8");

      for (const token of forbiddenStrings) {
        expect(content.includes(token)).toBe(false);
      }
    });

    it(`blocks sourcemap metadata in ${filePath}`, () => {
      const content = readFileSync(filePath, "utf8");

      for (const pattern of forbiddenRegexes) {
        expect(pattern.test(content)).toBe(false);
      }
    });

    it(`blocks weak keywords in visible HTML for ${filePath}`, () => {
      const content = readFileSync(filePath, "utf8");
      const visible = stripScriptAndStyle(content);

      for (const pattern of weakForbiddenRegexes) {
        expect(pattern.test(visible)).toBe(false);
      }
    });

    it(`blocks modulepreload/polyfill in ${filePath}`, () => {
      const content = readFileSync(filePath, "utf8");
      expect(content.includes("modulepreload")).toBe(false);
    });
  }
});
