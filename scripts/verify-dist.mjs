import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distFiles = [
  resolve("dist", "index.html"),
  resolve("dist", "index.min.html"),
];

const strongPatterns = [
  { name: "ban-word:http://", kind: "BAN_WORD", regex: /http:\/\//g },
  { name: "ban-word:https://", kind: "BAN_WORD", regex: /https:\/\//g },
  { name: "ban-word:GITHUB_WORKSPACE", kind: "BAN_WORD", regex: /GITHUB_WORKSPACE/g },
  { name: "ban-word:github.com", kind: "BAN_WORD", regex: /github\.com/g },
  { name: "ban-word:api.github.com", kind: "BAN_WORD", regex: /api\.github\.com/g },
  {
    name: "ban-word:raw.githubusercontent.com",
    kind: "BAN_WORD",
    regex: /raw\.githubusercontent\.com/g,
  },
  { name: "ban-word:github", kind: "BAN_WORD", regex: /\bgithub\b/gi },
  { name: "sourcemap:sourceMappingURL", kind: "SOURCEMAP", regex: /sourceMappingURL=/g },
  {
    name: "sourcemap:data-application-json",
    kind: "SOURCEMAP",
    regex: /data:application\/json(?:;base64)?/g,
  },
  { name: "modulepreload", kind: "MODULEPRELOAD", regex: /modulepreload/g },
];

const weakPatterns = [
  { name: "ban-word:api", kind: "BAN_WORD", regex: /\bapi\b/gi },
];

const contextRadius = 40;
const maxSamples = 3;

function stripScriptAndStyle(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

for (const distPath of distFiles) {
  if (!existsSync(distPath)) {
    console.error(`[verify:dist] Missing file: ${distPath}`);
    process.exit(1);
  }

  const content = readFileSync(distPath, "utf8");
  const failures = [];

  for (const { name, kind, regex } of strongPatterns) {
    regex.lastIndex = 0;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const index = match.index;
      const start = Math.max(0, index - contextRadius);
      const end = Math.min(content.length, index + match[0].length + contextRadius);
      const snippet = content.slice(start, end).replace(/\s+/g, " ");
      matches.push({ index, snippet });
    }

    if (matches.length > 0) {
      failures.push({ name, kind, matches });
    }
  }

  const visibleContent = stripScriptAndStyle(content);
  for (const { name, kind, regex } of weakPatterns) {
    regex.lastIndex = 0;
    const matches = [];
    let match;
    while ((match = regex.exec(visibleContent)) !== null) {
      const index = match.index;
      const start = Math.max(0, index - contextRadius);
      const end = Math.min(visibleContent.length, index + match[0].length + contextRadius);
      const snippet = visibleContent.slice(start, end).replace(/\s+/g, " ");
      matches.push({ index, snippet });
    }

    if (matches.length > 0) {
      failures.push({ name, kind, matches });
    }
  }

  if (failures.length > 0) {
    console.error(`[verify:dist] Forbidden patterns detected in ${distPath}:`);
    for (const failure of failures) {
      console.error(`- ${failure.kind}: ${failure.name} (count: ${failure.matches.length})`);
      failure.matches.slice(0, maxSamples).forEach((sample, idx) => {
        console.error(`  [${idx + 1}] @${sample.index}: ${sample.snippet}`);
      });
    }
    process.exit(1);
  }
}

console.log("[verify:dist] OK: dist/index.html and dist/index.min.html passed checks.");
