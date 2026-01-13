export type MonacoLanguageId =
  | "plaintext"
  | "php"
  | "csharp"
  | "javascript"
  | "typescript"
  | "html"
  | "css"
  | "json"
  | "markdown";

const EXTENSION_LANGUAGE_MAP: Array<[string, MonacoLanguageId]> = [
  [".cshtml.cs", "csharp"],
  [".cshtml", "csharp"],
  [".csx", "csharp"],
  [".cs", "csharp"],
  [".php", "php"],
  [".inc", "php"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".js", "javascript"],
  [".tsx", "typescript"],
  [".ts", "typescript"],
  [".html", "html"],
  [".htm", "html"],
  [".css", "css"],
  [".json", "json"],
  [".md", "markdown"],
];

export function detectLanguageFromFileName(fileName: string): MonacoLanguageId {
  const lower = fileName.toLowerCase();
  for (const [ext, language] of EXTENSION_LANGUAGE_MAP) {
    if (lower.endsWith(ext)) {
      return language;
    }
  }
  return "plaintext";
}

export function inferPaneLanguage(fileNames: readonly string[]): MonacoLanguageId {
  if (fileNames.length === 0) {
    return "plaintext";
  }
  const detected = fileNames.map((name) => detectLanguageFromFileName(name));
  const priority: MonacoLanguageId[] = [
    "csharp",
    "php",
    "html",
    "typescript",
    "javascript",
    "css",
    "json",
    "markdown",
    "plaintext",
  ];
  const present = new Set(detected);
  for (const candidate of priority) {
    if (present.has(candidate)) {
      return candidate;
    }
  }
  return "plaintext";
}
