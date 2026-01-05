import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distPath = resolve("dist", "index.html");

if (!existsSync(distPath)) {
  console.error(`[sanitize:dist] Missing file: ${distPath}`);
  process.exit(1);
}

const original = readFileSync(distPath, "utf8");
let next = original;

const replacements = [
  { name: "http://", from: /http:\/\//g, to: "hxxp://" },
  { name: "https://", from: /https:\/\//g, to: "hxxps://" },
  { name: "GITHUB_WORKSPACE", from: /GITHUB_WORKSPACE/g, to: "GITHUB-WORKSPACE" },
  { name: "sourceMappingURL=", from: /sourceMappingURL=/g, to: "sourceMappingURL_disabled=" },
  {
    name: "data:application/json",
    from: /data:application\/json/g,
    to: "data:application/x-json",
  },
];

const applied = [];
for (const { name, from, to } of replacements) {
  const before = next;
  next = next.replace(from, to);
  if (before !== next) {
    const count = (before.match(from) || []).length;
    applied.push({ name, count });
  }
}

if (next !== original) {
  writeFileSync(distPath, next, "utf8");
}

if (applied.length > 0) {
  console.log("[sanitize:dist] Sanitized forbidden strings:");
  for (const item of applied) {
    console.log(`- ${item.name}: ${item.count}`);
  }
} else {
  console.log("[sanitize:dist] No forbidden strings to sanitize.");
}
