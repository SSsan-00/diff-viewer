import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const minifyOnly = args.has("--minify-only");

const distPath = resolve("dist");
const readablePath = resolve(distPath, "index.html");
const minifyDir = resolve("dist-min");
const minifySource = resolve(minifyDir, "index.html");
const minifyTarget = resolve(distPath, "index.min.html");

function sanitizeHtml(content) {
  const escapeGithubWord = (match) => {
    const first = match[0];
    const hEscape = first === first.toUpperCase() ? "\\u0048" : "\\u0068";
    return `${first}it${hEscape}ub`;
  };

  return content
    .replace(/http:\/\//g, "http:\\u002f\\u002f")
    .replace(/https:\/\//g, "https:\\u002f\\u002f")
    .replace(/GITHUB_WORKSPACE/g, "GITHUB_\\u0057ORKSPACE")
    .replace(/githubusercontent/gi, (match) => {
      const escaped = escapeGithubWord(match.slice(0, 6));
      return `${escaped}${match.slice(6)}`;
    })
    .replace(/github\.com/gi, (match) => {
      const escaped = escapeGithubWord(match.slice(0, 6));
      return `${escaped}${match.slice(6)}`;
    })
    .replace(/\bgithub\b/gi, escapeGithubWord);
}

if (!existsSync(minifySource)) {
  console.error(`[assemble-dist] Missing file: ${minifySource}`);
  process.exit(1);
}

if (!minifyOnly && !existsSync(readablePath)) {
  console.error(`[assemble-dist] Missing file: ${readablePath}`);
  process.exit(1);
}

const minified = readFileSync(minifySource, "utf8");
writeFileSync(minifyTarget, sanitizeHtml(minified));

rmSync(minifyDir, { recursive: true, force: true });

if (!minifyOnly) {
  const readable = readFileSync(readablePath, "utf8");
  writeFileSync(readablePath, sanitizeHtml(readable));
}

const keep = new Set(["index.html", "index.min.html"]);
for (const entry of readdirSync(distPath)) {
  if (keep.has(entry)) {
    continue;
  }
  rmSync(resolve(distPath, entry), { recursive: true, force: true });
}

console.log(
  `[assemble-dist] Wrote ${minifyTarget}${minifyOnly ? " (minify-only)" : ""}.`
);
