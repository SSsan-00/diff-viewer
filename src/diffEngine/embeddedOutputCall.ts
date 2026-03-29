const DISALLOWED_CALL_NAMES = new Set([
  "echo",
  "if",
  "for",
  "foreach",
  "while",
  "switch",
  "case",
  "return",
]);

function normalizeCallName(name: string | undefined): string | null {
  if (!name) {
    return null;
  }
  const normalized = name.toLowerCase();
  if (DISALLOWED_CALL_NAMES.has(normalized)) {
    return null;
  }
  return normalized;
}

function extractPhpEmbeddedOutputCall(line: string): string | null {
  const match = line.trim().match(/^<\?(?:php\b)?([\s\S]*?)\?>$/i);
  if (!match) {
    return null;
  }

  let body = match[1]?.trim() ?? "";
  if (body.startsWith("=")) {
    body = body.slice(1).trimStart();
  } else if (/^echo\b/i.test(body)) {
    body = body.replace(/^echo\b/i, "").trimStart();
  }

  const callMatch = body.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return normalizeCallName(callMatch?.[1]);
}

function extractRazorEmbeddedOutputCall(line: string): string | null {
  const trimmed = line.trim();
  const rawMatch = trimmed.match(
    /^@\s*(?:Html\.)?Raw\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
  );
  if (rawMatch) {
    return normalizeCallName(rawMatch[1]);
  }

  return null;
}

export function extractEmbeddedOutputCall(line: string): string | null {
  return extractPhpEmbeddedOutputCall(line) ?? extractRazorEmbeddedOutputCall(line);
}
