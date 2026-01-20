const KEYWORDS = new Set([
  "var",
  "let",
  "const",
  "function",
  "fn",
  "string",
  "int",
  "float",
  "double",
  "bool",
  "boolean",
  "void",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "abstract",
  "async",
  "await",
  "return",
  "class",
  "interface",
  "trait",
  "extends",
  "implements",
  "new",
  "namespace",
  "using",
  "if",
  "else",
  "elseif",
  "for",
  "foreach",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "include",
  "require",
  "global",
]);

function stripDollarIdentifiers(line: string): string {
  return line.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, "$1");
}

function stripRazorLinePrefix(line: string): string {
  const match = line.match(/^(\s*)@:\s*/);
  if (!match) {
    return line;
  }
  return match[1] + line.slice(match[0].length);
}

function extractBraceToken(line: string): "brace_open" | "brace_close" | null {
  const trimmed = line.trim();
  if (trimmed === "{") {
    return "brace_open";
  }
  if (trimmed === "}") {
    return "brace_close";
  }
  const phpMatch = trimmed.match(
    /^<\?\s*(?:php\s*)?([{}])\s*\?\s*>?$/i,
  );
  if (phpMatch?.[1] === "{") {
    return "brace_open";
  }
  if (phpMatch?.[1] === "}") {
    return "brace_close";
  }
  return null;
}

export function extractLineKey(line: string): string | null {
  const normalizedLine = stripRazorLinePrefix(line);
  const braceToken = extractBraceToken(normalizedLine);
  if (braceToken) {
    return braceToken;
  }
  const normalized = stripDollarIdentifiers(normalizedLine.trimStart());
  const funcMatch = normalized.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (funcMatch) {
    const candidate = funcMatch[1].toLowerCase();
    if (!KEYWORDS.has(candidate)) {
      return candidate;
    }
  }

  const tokens = normalized.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const filtered = tokens.map((token) => token.toLowerCase()).filter((token) => !KEYWORDS.has(token));
  if (filtered.length > 0) {
    return filtered[0];
  }

  return null;
}
