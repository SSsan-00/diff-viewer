import { findDistFailures } from "./dist-rules.mjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distFiles = [
  resolve("dist", "index.html"),
  resolve("dist", "index.min.html"),
];

const maxSamples = 3;

for (const distPath of distFiles) {
  if (!existsSync(distPath)) {
    console.error(`[verify:dist] Missing file: ${distPath}`);
    process.exit(1);
  }

  const content = readFileSync(distPath, "utf8");
  const failures = findDistFailures(content);

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
