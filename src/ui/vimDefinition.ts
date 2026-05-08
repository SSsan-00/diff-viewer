type DefinitionMatch = {
  column: number;
  lineNumber: number;
};

type WordAtPosition = {
  word: string;
};

type Position = {
  column: number;
  lineNumber: number;
};

type TextModelLike = {
  getLineContent: (lineNumber: number) => string;
  getLineCount: () => number;
  getWordAtPosition?: (position: Position) => WordAtPosition | null;
};

export type DefinitionEditorLike = {
  focus: () => void;
  getModel: () => TextModelLike | null;
  getPosition: () => Position | null;
  revealLineInCenter?: (lineNumber: number) => void;
  setPosition: (position: Position) => void;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getWordAtPosition(model: TextModelLike, position: Position): string {
  const modelWord = model.getWordAtPosition?.(position)?.word;
  if (modelWord) {
    return modelWord;
  }
  const line = model.getLineContent(position.lineNumber);
  const index = Math.max(0, position.column - 1);
  const left = line.slice(0, index).match(/[A-Za-z0-9_$]+$/)?.[0] ?? "";
  const right = line.slice(index).match(/^[A-Za-z0-9_$]+/)?.[0] ?? "";
  return `${left}${right}`;
}

function buildDefinitionPatterns(word: string): RegExp[] {
  const escaped = escapeRegExp(word);
  const modifiers =
    "(?:public|private|protected|internal|static|virtual|override|async|sealed|partial|readonly|extern|unsafe|abstract|new)\\s+";
  const typeName = "[A-Za-z_$][\\w$]*(?:\\s*<[^>]+>)?(?:\\s*\\[\\])?";
  return [
    new RegExp(`\\b(?:class|interface|enum|struct|record)\\s+${escaped}\\b`),
    new RegExp(`\\b(?:function\\s+${escaped}|(?:const|let|var)\\s+${escaped})\\b`),
    new RegExp(`\\b${escaped}\\s*[:=]`),
    new RegExp(`\\b(?:${modifiers})*${typeName}\\s+${escaped}\\s*\\(`),
  ];
}

export function findDefinitionLine(
  text: string,
  word: string,
  currentLineNumber = 1,
): DefinitionMatch | null {
  const normalizedWord = word.trim();
  if (!normalizedWord) {
    return null;
  }
  const lines = text.split(/\r\n|\r|\n/);
  const patterns = buildDefinitionPatterns(normalizedWord);
  const candidates = lines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => patterns.some((pattern) => pattern.test(line)));
  if (candidates.length === 0) {
    return null;
  }

  const preferred =
    candidates.find((candidate) => candidate.lineNumber !== currentLineNumber) ??
    candidates[0];
  const column = preferred.line.indexOf(normalizedWord) + 1;
  return {
    column: Math.max(column, 1),
    lineNumber: preferred.lineNumber,
  };
}

export function goToLikelyDefinition(editor: DefinitionEditorLike): boolean {
  const model = editor.getModel();
  const position = editor.getPosition();
  if (!model || !position) {
    return false;
  }
  const word = getWordAtPosition(model, position);
  const lines: string[] = [];
  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    lines.push(model.getLineContent(lineNumber));
  }
  const match = findDefinitionLine(lines.join("\n"), word, position.lineNumber);
  if (!match) {
    return false;
  }
  editor.setPosition({ lineNumber: match.lineNumber, column: match.column });
  editor.revealLineInCenter?.(match.lineNumber);
  editor.focus();
  return true;
}
