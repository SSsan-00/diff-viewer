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

export function extractLineKey(line: string): string | null {
  const normalized = stripDollarIdentifiers(line.trimStart());
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
