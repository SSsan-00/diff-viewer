import { expect, it } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findDistFailures } from "./dist-rules.mjs";

it("validates both distributed HTML files with the release rules", () => {
  for (const file of ["dist/index.html", "dist/index.min.html"]) {
    expect(findDistFailures(readFileSync(file, "utf8"))).toEqual([]);
  }
});

it.each([
  ["http://example", "ban-word:http://"],
  ["https://example", "ban-word:https://"],
  ["GITHUB_WORKSPACE", "ban-word:GITHUB_WORKSPACE"],
  ["github.com", "ban-word:github.com"],
  ["api.github.com", "ban-word:api.github.com"],
  ["raw.githubusercontent.com", "ban-word:raw.githubusercontent.com"],
  ['<script>"GitHub"</script>', "ban-word:github"],
  ["sourceMappingURL=x", "sourcemap:sourceMappingURL"],
  ["data:application/json;charset=utf-8,{}", "sourcemap:data-application-json"],
  ["modulepreload", "modulepreload"],
  ["API", "ban-word:api"],
])("rejects %s with the release rule %s", (content, name) => {
  expect(findDistFailures(content).map((failure: { name: string }) => failure.name)).toContain(name);
});

it("allows weak keywords only in script/style and resets repeated regex searches", () => {
  const allowed = '<script>"api"</script><style>.api {}</style><p>capital</p>';
  expect(findDistFailures(allowed)).toEqual([]);
  expect(findDistFailures("github")).not.toEqual([]);
  expect(findDistFailures("github")).not.toEqual([]);
  expect(findDistFailures(allowed)).toEqual([]);
});

it("reports a forbidden release artifact with context and a failing exit code", () => {
  const directory = mkdtempSync(join(tmpdir(), "dist-rules-"));
  try {
    mkdirSync(join(directory, "dist"));
    writeFileSync(join(directory, "dist/index.html"), "<p>https://example</p>");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-dist.mjs", import.meta.url))], { cwd: directory, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BAN_WORD: ban-word:https:// (count: 1)");
    expect(result.stderr).toContain("<p>https://example</p>");
    expect(result.stderr).not.toContain("ReferenceError");
  } finally {
    rmSync(directory, {recursive:true, force:true});
  }
});
