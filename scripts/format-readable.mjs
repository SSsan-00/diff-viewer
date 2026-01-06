import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distPath = resolve("dist", "index.html");

if (!existsSync(distPath)) {
  console.error(`[format-readable] Missing file: ${distPath}`);
  process.exit(1);
}

const html = readFileSync(distPath, "utf8");

function formatCss(css) {
  let result = "";
  let indent = 0;
  let inString = false;
  let stringQuote = "";
  let inComment = false;

  const pushIndent = () => {
    result += "  ".repeat(indent);
  };

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    const next = css[i + 1];

    if (inComment) {
      result += char;
      if (char === "*" && next === "/") {
        result += next;
        i += 1;
        inComment = false;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === stringQuote && css[i - 1] !== "\\") {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (char === "/" && next === "*") {
      inComment = true;
      result += "/*";
      i += 1;
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      stringQuote = char;
      result += char;
      continue;
    }

    if (char === "{") {
      result = result.trimEnd();
      result += " {\n";
      indent += 1;
      pushIndent();
      continue;
    }

    if (char === "}") {
      indent = Math.max(0, indent - 1);
      result = result.trimEnd();
      result += "\n";
      pushIndent();
      result += "}\n";
      pushIndent();
      continue;
    }

    if (char === ";") {
      result = result.trimEnd();
      result += ";\n";
      pushIndent();
      continue;
    }

    if (char === "\n" || char === "\r" || char === "\t") {
      if (!result.endsWith(" ") && !result.endsWith("\n")) {
        result += " ";
      }
      continue;
    }

    result += char;
  }

  return result.trim();
}

const updated = html.replace(
  /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
  (match, attrs, css) => {
    const formatted = formatCss(css);
    return `<style${attrs}>\n${formatted}\n</style>`;
  }
);

writeFileSync(distPath, updated);
console.log(`[format-readable] Formatted CSS in ${distPath}.`);
