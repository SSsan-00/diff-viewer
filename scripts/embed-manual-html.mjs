import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PLACEHOLDER = "__DIFF_VIEWER_MANUAL_HTML__";

function encodeManualHtmlForEmbedding(content) {
  return content.replace(/<\/script/gi, "<\\/script");
}

function embedManualHtml(distFile, manualHtml) {
  if (!existsSync(distFile)) {
    throw new Error(`Missing dist file: ${distFile}`);
  }
  const current = readFileSync(distFile, "utf8");
  const manualSourcePattern =
    /(<script\b(?=[^>]*id="manual-html-source")[^>]*>)([\s\S]*?)(<\/script>)/;
  const match = current.match(manualSourcePattern);
  if (!match) {
    throw new Error(`Manual source element not found in ${distFile}`);
  }
  if (!match[2].includes(PLACEHOLDER)) {
    throw new Error(`Manual placeholder not found in ${distFile}`);
  }
  writeFileSync(
    distFile,
    current.replace(manualSourcePattern, (_, prefix, _body, suffix) => {
      return `${prefix}${manualHtml}${suffix}`;
    }),
  );
}

const manualPath = resolve("doc", "MANUAL.html");
const manualHtml = encodeManualHtmlForEmbedding(readFileSync(manualPath, "utf8"));

embedManualHtml(resolve("dist", "index.html"), manualHtml);
embedManualHtml(resolve("dist", "index.min.html"), manualHtml);

console.log("[embed-manual-html] Embedded MANUAL.html into dist files.");
