import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const minifyOnly = args.has("--minify-only");

const distPath = resolve("dist");
const readablePath = resolve(distPath, "index.html");
const minifyDir = resolve("dist-min");
const minifySource = resolve(minifyDir, "index.html");
const minifyTarget = resolve(distPath, "index.min.html");

if (!existsSync(minifySource)) {
  console.error(`[assemble-dist] Missing file: ${minifySource}`);
  process.exit(1);
}

if (!minifyOnly && !existsSync(readablePath)) {
  console.error(`[assemble-dist] Missing file: ${readablePath}`);
  process.exit(1);
}

const minified = readFileSync(minifySource, "utf8");
writeFileSync(minifyTarget, minified);

rmSync(minifyDir, { recursive: true, force: true });

console.log(
  `[assemble-dist] Wrote ${minifyTarget}${minifyOnly ? " (minify-only)" : ""}.`
);
