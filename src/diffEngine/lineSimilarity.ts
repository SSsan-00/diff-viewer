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

function stripStringLiterals(source: string): string {
  return source.replace(/'([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"/g, "");
}

function isElseLine(line: string): boolean {
  const stripped = stripStringLiterals(line);
  return /\belse\b/i.test(stripped);
}

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

type DateFormatInfo = {
  format: string;
  arg: string;
};

function extractDateFormatInfo(line: string): DateFormatInfo | null {
  const match = line.match(
    /\b(?:to_char|format)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*['"]([^'"]+)['"]\s*\)/i,
  );
  if (!match) {
    return null;
  }
  return { arg: match[1].toLowerCase(), format: match[2].toLowerCase() };
}

function normalizeLine(line: string): string {
  let normalized = line.trimStart().replace(/\$/g, "");
  normalized = normalized.replace(/(?:\b[A-Za-z_][A-Za-z0-9_]*\.)+/g, "");
  return normalized;
}

function normalizeFragment(fragment: string): string {
  return fragment
    .replace(/\s+/g, " ")
    .replace(/\s*([{}();:,])\s*/g, "$1")
    .replace(/['"]/g, "\"")
    .trim()
    .toLowerCase();
}

function normalizeTemplateExpression(expression: string): string {
  return expression
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTemplateLine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let base: string | null = null;
  if (detectAppendLike(line)) {
    const literal = extractAppendLiteral(line) ?? extractLiterals(line)[0];
    if (!literal) {
      return null;
    }
    base = literal;
  } else if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    base = trimmed;
  }

  if (!base) {
    return null;
  }

  let normalized = base.replace(/[¥￥]/g, "\\");
  normalized = normalized.replace(
    /<\?\s*=?\s*([^?]*?)\s*\?>/gi,
    (_, expr: string) => `{${normalizeTemplateExpression(expr) || "expr"}}`,
  );
  normalized = normalized.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) =>
    `{${name.toLowerCase()}}`,
  );
  normalized = normalized.replace(/\{[^}]*\}/g, "{expr}");

  return normalizeFragment(normalized);
}

function extractHtmlSignature(line: string): { tag: string | null; attrs: string[] } {
  const attrs: string[] = [];
  const normalized = line.replace(/<\?\s*=?\s*[^?]*?\s*\?>/gi, " ");
  const tagMatch = normalized.match(/<\s*\/?\s*([a-z][a-z0-9-]*)/i);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
  const attrRegex = /([a-zA-Z_:][a-zA-Z0-9_:-]*)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(normalized)) !== null) {
    attrs.push(match[1].toLowerCase());
  }
  return { tag, attrs };
}

function extractStructuredFragment(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return normalizeFragment(trimmed);
  }
  if (
    trimmed === "{" ||
    trimmed === "}" ||
    /^<\?\s*(?:php\s*)?[{}]\s*\?\s*>?$/i.test(trimmed)
  ) {
    return null;
  }
  if (detectAppendLike(line)) {
    const literal = extractAppendLiteral(line) ?? extractLiterals(line)[0];
    if (literal) {
      return normalizeFragment(literal);
    }
    return null;
  }

  if (/^(function|console\.|return|if|for|while|switch|case)\b/i.test(trimmed)) {
    return normalizeFragment(trimmed);
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return normalizeFragment(trimmed);
  }

  if (!/[{};:]/.test(trimmed)) {
    return null;
  }

  if (/^[A-Za-z0-9_.#\s-]+{\s*$/i.test(trimmed)) {
    return normalizeFragment(trimmed);
  }

  if (/^}\s*;?\s*$/.test(trimmed)) {
    return normalizeFragment(trimmed);
  }

  if (/^[A-Za-z-]+\s*:\s*[^;]+;?\s*$/.test(trimmed)) {
    return normalizeFragment(trimmed);
  }

  return null;
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

function extractAppendLiteral(line: string): string | null {
  const callMatch = line.match(/\.(?:append|appendline|appendformat)\s*\(/i);
  if (!callMatch || callMatch.index === undefined) {
    return null;
  }
  const startFrom = callMatch.index + callMatch[0].length;
  const quoteIndex = line.indexOf("\"", startFrom);
  if (quoteIndex === -1) {
    return null;
  }
  const prefix = line.slice(startFrom, quoteIndex);
  const isInterpolated = prefix.includes("$");
  const isVerbatim = prefix.includes("@");
  let result = "";
  let i = quoteIndex + 1;
  while (i < line.length) {
    const ch = line[i];
    if (!isVerbatim && ch === "\\" && i + 1 < line.length) {
      result += line[i + 1];
      i += 2;
      continue;
    }
    if (isVerbatim && ch === "\"" && line[i + 1] === "\"") {
      result += "\"";
      i += 2;
      continue;
    }
    if (ch === "\"") {
      break;
    }
    if (isInterpolated && ch === "{") {
      if (line[i + 1] === "{") {
        result += "{";
        i += 2;
        continue;
      }
      result += "{expr}";
      i += 1;
      let depth = 1;
      while (i < line.length && depth > 0) {
        const c = line[i];
        if (c === "{" && line[i + 1] !== "{") {
          depth += 1;
        } else if (c === "}" && line[i + 1] !== "}") {
          depth -= 1;
        }
        if (c === "\"" && !isVerbatim) {
          i += 1;
          while (i < line.length) {
            if (line[i] === "\\" && i + 1 < line.length) {
              i += 2;
              continue;
            }
            if (line[i] === "\"") {
              i += 1;
              break;
            }
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      continue;
    }
    if (isInterpolated && ch === "}" && line[i + 1] === "}") {
      result += "}";
      i += 2;
      continue;
    }
    result += ch;
    i += 1;
  }
  return result.trim().length > 0 ? result : null;
}

function unescapeLiteral(value: string): string {
  return value
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'");
}

function extractLiterals(line: string): string[] {
  const matches = line.match(/'([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"/g) ?? [];
  const literals: string[] = [];
  matches.forEach((value) => {
    const unescaped = unescapeLiteral(value.slice(1, -1)).replace(/[¥￥]/g, "\\");
    const normalized = unescaped.toLowerCase();
    literals.push(normalized);
    if (normalized.endsWith(".php")) {
      const base = normalized.slice(0, -4);
      if (base.length > 0) {
        literals.push(base);
      }
    }
  });
  return literals;
}

function extractHtmlHintTokens(source: string): string[] {
  const tokens: string[] = [];
  const tagMatches = source.matchAll(/<\s*\/?\s*([a-z][a-z0-9-]*)/gi);
  for (const match of tagMatches) {
    tokens.push(`hint:html:tag:${match[1].toLowerCase()}`);
  }
  if (/\bclass\s*=/.test(source)) {
    tokens.push("hint:html:attr:class");
  }
  if (/\bid\s*=/.test(source)) {
    tokens.push("hint:html:attr:id");
  }
  if (/\bhref\s*=/.test(source)) {
    tokens.push("hint:html:attr:href");
  }
  if (/\bsrc\s*=/.test(source)) {
    tokens.push("hint:html:attr:src");
  }
  if (/\brole\s*=/.test(source)) {
    tokens.push("hint:html:attr:role");
  }
  if (/\btype\s*=/.test(source)) {
    tokens.push("hint:html:attr:type");
  }
  if (/\bdata-[a-z0-9_-]+\s*=/.test(source)) {
    tokens.push("hint:html:attr:data");
  }
  if (/\baria-[a-z0-9_-]+\s*=/.test(source)) {
    tokens.push("hint:html:attr:aria");
  }
  return tokens;
}

function extractJsHintTokens(source: string): string[] {
  const tokens: string[] = [];
  if (/\bconst\b/.test(source)) {
    tokens.push("hint:js:const");
  }
  if (/\blet\b/.test(source)) {
    tokens.push("hint:js:let");
  }
  if (/\bvar\b/.test(source)) {
    tokens.push("hint:js:var");
  }
  if (/\bdocument\b/.test(source)) {
    tokens.push("hint:js:document");
  }
  if (/\bwindow\b/.test(source)) {
    tokens.push("hint:js:window");
  }
  if (/\bquerySelector(All)?\b/.test(source)) {
    tokens.push("hint:js:querySelector");
  }
  if (/\bgetElementById\b/.test(source)) {
    tokens.push("hint:js:getElementById");
  }
  if (/\bgetElementsByClassName\b/.test(source)) {
    tokens.push("hint:js:getElementsByClassName");
  }
  if (/\baddEventListener\b/.test(source)) {
    tokens.push("hint:js:addEventListener");
  }
  if (/\bclassList\b/.test(source)) {
    tokens.push("hint:js:classList");
  }
  if (/\binnerHTML\b/.test(source)) {
    tokens.push("hint:js:innerHTML");
  }
  if (/\btextContent\b/.test(source)) {
    tokens.push("hint:js:textContent");
  }
  if (/\bfunction\b/.test(source)) {
    tokens.push("hint:js:function");
  }
  if (/\breturn\b/.test(source)) {
    tokens.push("hint:js:return");
  }
  if (/\bif\b/.test(source)) {
    tokens.push("hint:js:if");
  }
  if (/\bfor\b/.test(source)) {
    tokens.push("hint:js:for");
  }
  if (/\bwhile\b/.test(source)) {
    tokens.push("hint:js:while");
  }
  if (/=>/.test(source)) {
    tokens.push("hint:js:arrow");
  }
  return tokens;
}

function extractEmbeddedHintTokens(source: string): string[] {
  const tokens = new Set<string>();
  extractHtmlHintTokens(source).forEach((token) => tokens.add(token));
  extractJsHintTokens(source).forEach((token) => tokens.add(token));
  return [...tokens];
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

  const primaryCandidates = identifiers.filter(
    (token) => !token.startsWith("hint:") && !token.startsWith("codefrag:"),
  );
  if (primaryCandidates.length > 0) {
    return primaryCandidates.reduce((best, current) =>
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
  const appendLike = detectAppendLike(line);
  const templateSignature = normalizeTemplateLine(line);
  if (templateSignature) {
    identifiers.push(`template:${templateSignature}`);
    const signature = detectAppendLike(line)
      ? extractAppendLiteral(line) ?? extractLiterals(line)[0] ?? ""
      : line;
    const htmlSignature = extractHtmlSignature(signature);
    if (htmlSignature.tag) {
      identifiers.push(`htmltag:${htmlSignature.tag}`);
    }
    htmlSignature.attrs.forEach((attr) => identifiers.push(`htmlattr:${attr}`));
  }
  const structuredFragment = extractStructuredFragment(line);
  if (structuredFragment) {
    identifiers.push(`codefrag:${structuredFragment}`);
    if (structuredFragment === "{") {
      identifiers.push("brace_open");
    } else if (structuredFragment === "}") {
      identifiers.push("brace_close");
    }
  }
  if (isElseLine(line)) {
    identifiers.push("else_line");
  }
  const braceToken = extractBraceToken(line);
  if (braceToken) {
    identifiers.push(braceToken);
  }
  const category = detectCategory(line);
  const primaryId = pickPrimaryId(identifiers, literals, line);
  extractEmbeddedHintTokens(line).forEach((token) => identifiers.push(token));
  if (appendLike) {
    literals.forEach((literal) => {
      extractEmbeddedHintTokens(literal).forEach((token) => identifiers.push(token));
    });
  }
  if (appendLike && !identifiers.includes("append")) {
    identifiers.push("append");
  }
  const initVar = extractInitVariable(line);
  if (initVar) {
    identifiers.push("init");
    identifiers.push(`init:${initVar}`);
  }
  const dateFormat = extractDateFormatInfo(line);
  if (dateFormat) {
    identifiers.push("dateformat");
    identifiers.push(`dateformat:${dateFormat.format}`);
    identifiers.push(`dateformatarg:${dateFormat.arg}`);
  }
  return { identifiers, literals, numbers, primaryId, category };
}

function filterHintTokens(identifiers: string[]): string[] {
  return identifiers.filter((token) => token.startsWith("hint:"));
}

function filterStrongIdentifiers(identifiers: string[]): string[] {
  return identifiers.filter(
    (token) => !token.startsWith("hint:") && !token.startsWith("codefrag:"),
  );
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
  const strongLeftIds = filterStrongIdentifiers(left.identifiers);
  const strongRightIds = filterStrongIdentifiers(right.identifiers);
  const idOverlap = intersectCount(strongLeftIds, strongRightIds);
  const hintOverlap = intersectCount(
    filterHintTokens(left.identifiers),
    filterHintTokens(right.identifiers),
  );
  const literalOverlap = intersectCount(left.literals, right.literals);
  const numberOverlap = intersectCount(left.numbers, right.numbers);
  const initOverlap = left.identifiers.some(
    (token) => token.startsWith("init:") && right.identifiers.includes(token),
  );
  const dateFormatOverlap = left.identifiers.some(
    (token) => token.startsWith("dateformat:") && right.identifiers.includes(token),
  );
  const dateFormatArgOverlap = left.identifiers.some(
    (token) => token.startsWith("dateformatarg:") && right.identifiers.includes(token),
  );
  const codefragOverlap = left.identifiers.some(
    (token) => token.startsWith("codefrag:") && right.identifiers.includes(token),
  );
  const braceOverlap =
    (left.identifiers.includes("brace_open") &&
      right.identifiers.includes("brace_open")) ||
    (left.identifiers.includes("brace_close") &&
      right.identifiers.includes("brace_close"));
  const elseOverlap =
    left.identifiers.includes("else_line") &&
    right.identifiers.includes("else_line");
  const hasDateFormat =
    left.identifiers.includes("dateformat") ||
    right.identifiers.includes("dateformat");
  const hasBaseOverlap =
    idOverlap > 0 ||
    literalOverlap > 0 ||
    codefragOverlap ||
    braceOverlap ||
    elseOverlap ||
    initOverlap ||
    dateFormatArgOverlap;

  if (left.primaryId && right.primaryId && left.primaryId !== right.primaryId) {
    if (!hasBaseOverlap) {
      return null;
    }
  }

  if (!left.primaryId || !right.primaryId) {
    if (!hasBaseOverlap) {
      return null;
    }
  }
  if (hasDateFormat && !dateFormatArgOverlap && literalOverlap === 0) {
    return null;
  }

  let score = 0;
  if (left.primaryId && right.primaryId && left.primaryId === right.primaryId) {
    score += 5;
  }
  score += literalOverlap * 2;
  score += numberOverlap * 1.5;
  score += idOverlap * 1;
  score += hintOverlap * 0.5;
  if (literalOverlap > 0 && idOverlap > 0) {
    score += 2;
  }
  if (codefragOverlap) {
    score += 5;
  }
  if (braceOverlap) {
    score += 5;
  }
  if (elseOverlap) {
    score += 4;
  }
  if (initOverlap) {
    score += 4;
  }
  if (dateFormatOverlap) {
    score += dateFormatArgOverlap ? 5 : 1;
  }

  if (left.category === right.category) {
    score += left.category === "decl" ? 1.5 : left.category === "call" ? 1 : 0.5;
  } else if (
    (left.category === "decl" && right.category === "call") ||
    (left.category === "call" && right.category === "decl")
  ) {
    score -= 1;
  }

  score += jaccardSimilarity(strongLeftIds, strongRightIds);

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
