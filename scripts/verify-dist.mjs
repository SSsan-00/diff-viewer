import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distPath = resolve("dist", "index.html");

if (!existsSync(distPath)) {
  console.error(`[verify:dist] Missing file: ${distPath}`);
  process.exit(1);
}

const content = readFileSync(distPath, "utf8");

const patterns = [
  { name: "ban-word:http://", kind: "BAN_WORD", regex: /http:\/\//g },
  { name: "ban-word:https://", kind: "BAN_WORD", regex: /https:\/\//g },
  { name: "ban-word:GITHUB_WORKSPACE", kind: "BAN_WORD", regex: /GITHUB_WORKSPACE/g },
  { name: "sourcemap:sourceMappingURL", kind: "SOURCEMAP", regex: /sourceMappingURL=/g },
  {
    name: "sourcemap:data-application-json",
    kind: "SOURCEMAP",
    regex: /data:application\/json(?:;base64)?/g,
  },
];

const failures = [];
const contextRadius = 40;
const maxSamples = 3;

for (const { name, kind, regex } of patterns) {
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

if (failures.length > 0) {
  console.error("[verify:dist] Forbidden patterns detected in dist/index.html:");
  for (const failure of failures) {
    console.error(`- ${failure.kind}: ${failure.name} (count: ${failure.matches.length})`);
    failure.matches.slice(0, maxSamples).forEach((sample, idx) => {
      console.error(`  [${idx + 1}] @${sample.index}: ${sample.snippet}`);
    });
  }
  process.exit(1);
}

console.log("[verify:dist] OK: dist/index.html passed ban word and sourcemap checks.");
