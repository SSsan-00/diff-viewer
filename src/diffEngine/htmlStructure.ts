// Keep offsets intact while hiding template expressions from the HTML scanner.
export function maskTemplateExpressions(line: string): string {
  const chars = line.split("");
  for (let i = 0; i < line.length; i += 1) {
    const php = line.startsWith("<?", i);
    const razor = line.startsWith("@Html.Raw", i) ? line.slice(i).match(/^@Html\.Raw\s*\(/) : null;
    if (!php && !razor) continue;
    const start = i;
    i += php ? 2 : razor![0].length;
    let quote = "";
    let depth = 1;
    for (; i < line.length; i += 1) {
      const ch = line[i];
      if (quote) {
        if (ch === "\\") i += 1;
        else if (ch === quote) quote = "";
      } else if (ch === "'" || ch === '"') quote = ch;
      else if (php && line.startsWith("?>", i)) { i += 2; break; }
      else if (!php && ch === "(") depth += 1;
      else if (!php && ch === ")" && --depth === 0) { i += 1; break; }
    }
    for (let j = start; j < i; j += 1) chars[j] = "_";
    i -= 1;
  }
  return chars.join("");
}

export function htmlPairKey(line: string): string | null {
  const masked = maskTemplateExpressions(line).trim();
  const tag = masked.match(/^<(html|input)\b([^<>]*)>$/i);
  if (!tag) return null;
  const name = tag[1].toLowerCase();
  if (name === "html") return "html";
  const attrs = new Map<string, string>();
  for (const attr of tag[2].matchAll(/([\w:-]+)\s*=\s*(['"])(.*?)\2/g)) attrs.set(attr[1].toLowerCase(), attr[3]);
  if (!attrs.get("name") && !attrs.get("id")) return null;
  return JSON.stringify([name, attrs.get("type"), attrs.get("name"), attrs.get("id")]);
}
