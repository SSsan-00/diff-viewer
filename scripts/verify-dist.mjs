import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distPath = resolve("dist", "index.html");

if (!existsSync(distPath)) {
  console.error(`[verify:dist] Missing file: ${distPath}`);
  process.exit(1);
}

const content = readFileSync(distPath, "utf8");

const patterns = [
  { name: "ban-word:http://", regex: /http:\/\//g },
  { name: "ban-word:https://", regex: /https:\/\//g },
  { name: "ban-word:GITHUB_WORKSPACE", regex: /GITHUB_WORKSPACE/g },
  { name: "sourcemap:sourceMappingURL", regex: /sourceMappingURL=/g },
  { name: "sourcemap:data-application-json", regex: /data:application\/json(?:;base64)?/g },
];

const failures = [];

for (const { name, regex } of patterns) {
  regex.lastIndex = 0;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match.index);
    if (matches.length >= 5) {
      break;
    }
  }

  if (matches.length > 0) {
    failures.push({ name, matches });
  }
}

if (failures.length > 0) {
  console.error("[verify:dist] Forbidden patterns detected in dist/index.html:");
  for (const failure of failures) {
    console.error(`- ${failure.name} (sample indices: ${failure.matches.join(", ")})`);
  }
  process.exit(1);
}

console.log("[verify:dist] OK: dist/index.html passed ban word and sourcemap checks.");
