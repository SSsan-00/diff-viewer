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

// Only fully parsed, unique attributes in the same order can form safe diff boundaries.
function inputAttributeValues(line: string): { names: string[]; values: Array<{ start: number; end: number }> } | null {
  const masked = maskTemplateExpressions(line);
  if (masked.length !== line.length) return null;
  const tag = /^[ \t]*<input\b/i.exec(masked);
  if (!tag) return null;
  const names: string[] = [];
  const values: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();
  let index = tag[0].length;
  while (index < masked.length) {
    const rest = masked.slice(index);
    if (/^[ \t]*\/?>(?:[ \t]*)$/.test(rest)) return values.length ? { names, values } : null;
    const attribute = /^[ \t]+([A-Za-z_:][A-Za-z0-9_:.-]*)/.exec(rest);
    if (!attribute) return null;
    const name = attribute[1].toLowerCase();
    if (seen.has(name)) return null;
    seen.add(name);
    index += attribute[0].length;
    const equals = /^[ \t]*=[ \t]*/.exec(masked.slice(index));
    if (!equals) {
      names.push(`${name}:boolean`);
      continue;
    }
    index += equals[0].length;
    const quote = masked[index++];
    if (quote !== '"' && quote !== "'") return null;
    const end = masked.indexOf(quote, index);
    if (end === -1) return null;
    names.push(`${name}:value`);
    values.push({ start: index, end });
    index = end + 1;
  }
  return null;
}

export function getInputAttributeDiffParts(left: string, right: string): Array<{
  left: { start: number; end: number };
  right: { start: number; end: number };
}> | null {
  const a = inputAttributeValues(left), b = inputAttributeValues(right);
  if (!a || !b || a.names.length !== b.names.length || a.names.some((name, i) => name !== b.names[i])) return null;
  const parts = [];
  let leftEnd = 0, rightEnd = 0;
  for (let i = 0; i < a.values.length; i += 1) {
    parts.push({ left: { start: leftEnd, end: a.values[i].start }, right: { start: rightEnd, end: b.values[i].start } });
    parts.push({ left: a.values[i], right: b.values[i] });
    leftEnd = a.values[i].end;
    rightEnd = b.values[i].end;
  }
  parts.push({ left: { start: leftEnd, end: left.length }, right: { start: rightEnd, end: right.length } });
  return parts;
}
