type LineCategory = "decl" | "call" | "other";

const MODIFIER_KEYWORDS = new Set([
  "var",
  "let",
  "const",
  "function",
  "fn",
  "def",
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
  "internal",
  "static",
  "readonly",
  "final",
  "abstract",
  "async",
  "override",
  "virtual",
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
  "define",
]);

const DECLARATION_KEYWORDS = new Set([
  "function",
  "fn",
  "def",
]);

const DECLARATION_MODIFIERS = new Set([
  "public",
  "private",
  "protected",
  "internal",
  "static",
  "readonly",
  "final",
  "abstract",
  "async",
  "override",
  "virtual",
]);

export type LineFeatures = {
  identifiers: string[];
  literals: string[];
  numbers: string[];
  primaryId: string | null;
  category: LineCategory;
};

function detectAppendLike(line: string): boolean {
  return (
    /\.(?:append|appendline|appendformat)\s*\(/i.test(line) ||
    /\.\=/.test(line)
  );
}

function extractInitVariable(line: string): string | null {
  const trimmed = line.trimStart();
  const csharpMatch = trimmed.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*new\b/i);
  if (csharpMatch) {
    return csharpMatch[1].toLowerCase();
  }
  const phpMatch = trimmed.match(/\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['"])\s*\2/);
  if (phpMatch) {
    return phpMatch[1].toLowerCase();
  }
  return null;
}

function normalizeLine(line: string): string {
  let normalized = line.trimStart().replace(/\$/g, "");
  normalized = normalized.replace(/(?:\b[A-Za-z_][A-Za-z0-9_]*\.)+/g, "");
  return normalized;
}

function extractLiterals(line: string): string[] {
  const matches = line.match(/'([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"/g) ?? [];
  return matches.map((value) => value.slice(1, -1).toLowerCase());
}

function extractNumbers(line: string): string[] {
  return line.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
}

function extractIdentifiers(line: string): string[] {
  const normalized = normalizeLine(line);
  const matches = normalized.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return matches
    .map((token) => token.toLowerCase())
    .filter((token) => !MODIFIER_KEYWORDS.has(token));
}

function extractFunctionName(line: string): string | null {
  const normalized = normalizeLine(line);
  const funcMatch = normalized.match(/\b(function|fn|def)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/i);
  if (funcMatch) {
    return funcMatch[2].toLowerCase();
  }
  const typeMatch = normalized.match(
    /\b([A-Za-z_][A-Za-z0-9_<>,\[\]]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
  );
  if (typeMatch) {
    return typeMatch[2].toLowerCase();
  }
  return null;
}

function detectCategory(line: string): LineCategory {
  const normalized = normalizeLine(line);
  const hasDeclarationKeyword = Array.from(DECLARATION_KEYWORDS).some((keyword) =>
    new RegExp(`\\b${keyword}\\b`, "i").test(normalized),
  );
  if (hasDeclarationKeyword) {
    return "decl";
  }
  const hasModifier = Array.from(DECLARATION_MODIFIERS).some((modifier) =>
    new RegExp(`\\b${modifier}\\b`, "i").test(normalized),
  );
  if (hasModifier && /\b[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(normalized)) {
    return "decl";
  }
  if (/\b[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(normalized)) {
    return "call";
  }
  return "other";
}

function pickPrimaryId(
  identifiers: string[],
  literals: string[],
  line: string,
): string | null {
  const funcName = extractFunctionName(line);
  if (funcName && !MODIFIER_KEYWORDS.has(funcName)) {
    return funcName;
  }

  if (identifiers.length > 0) {
    return identifiers.reduce((best, current) =>
      current.length > best.length ? current : best,
    );
  }

  if (literals.length > 0) {
    return literals.reduce((best, current) =>
      current.length > best.length ? current : best,
    );
  }

  return null;
}

export function buildLineFeatures(line: string): LineFeatures {
  const identifiers = extractIdentifiers(line);
  const literals = extractLiterals(line);
  const numbers = extractNumbers(line);
  const category = detectCategory(line);
  const primaryId = pickPrimaryId(identifiers, literals, line);
  if (detectAppendLike(line) && !identifiers.includes("append")) {
    identifiers.push("append");
  }
  const initVar = extractInitVariable(line);
  if (initVar) {
    identifiers.push("init");
    identifiers.push(`init:${initVar}`);
  }
  return { identifiers, literals, numbers, primaryId, category };
}

function intersectCount(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right);
  let count = 0;
  left.forEach((token) => {
    if (rightSet.has(token)) {
      count += 1;
    }
  });
  return count;
}

function jaccardSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  const setLeft = new Set(left);
  const setRight = new Set(right);
  const union = new Set([...setLeft, ...setRight]);
  if (union.size === 0) {
    return 0;
  }
  let intersection = 0;
  setLeft.forEach((token) => {
    if (setRight.has(token)) {
      intersection += 1;
    }
  });
  return intersection / union.size;
}

export function scoreLinePair(left: LineFeatures, right: LineFeatures): number | null {
  const idOverlap = intersectCount(left.identifiers, right.identifiers);
  const literalOverlap = intersectCount(left.literals, right.literals);
  const numberOverlap = intersectCount(left.numbers, right.numbers);
  const initOverlap = left.identifiers.some(
    (token) => token.startsWith("init:") && right.identifiers.includes(token),
  );

  if (left.primaryId && right.primaryId && left.primaryId !== right.primaryId) {
    if (idOverlap === 0 && literalOverlap === 0) {
      return null;
    }
  }

  if (!left.primaryId || !right.primaryId) {
    if (idOverlap === 0 && literalOverlap === 0) {
      return null;
    }
  }

  let score = 0;
  if (left.primaryId && right.primaryId && left.primaryId === right.primaryId) {
    score += 5;
  }
  score += literalOverlap * 2;
  score += numberOverlap * 1.5;
  score += idOverlap * 1;
  if (literalOverlap > 0 && idOverlap > 0) {
    score += 2;
  }
  if (initOverlap) {
    score += 4;
  }

  if (left.category === right.category) {
    score += left.category === "decl" ? 1.5 : left.category === "call" ? 1 : 0.5;
  } else if (
    (left.category === "decl" && right.category === "call") ||
    (left.category === "call" && right.category === "decl")
  ) {
    score -= 1;
  }

  score += jaccardSimilarity(left.identifiers, right.identifiers);

  return score;
}

export function extractIndexTokens(features: LineFeatures): string[] {
  const tokens = new Set<string>();
  if (features.primaryId) {
    tokens.add(features.primaryId);
  }
  features.identifiers.forEach((token) => tokens.add(token));
  features.literals.forEach((token) => tokens.add(token));
  return [...tokens];
}
