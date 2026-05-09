type EditorPosition = {
  column: number;
  lineNumber: number;
};

type BracketMatchModel = {
  getLineContent: (lineNumber: number) => string;
  getLineCount: () => number;
};

type BracketMatchEditor = {
  focus?: () => void;
  getModel: () => BracketMatchModel | null;
  getPosition: () => EditorPosition | null;
  revealPositionInCenterIfOutsideViewport?: (position: EditorPosition) => void;
  setPosition: (position: EditorPosition) => void;
};

const OPEN_TO_CLOSE = new Map<string, string>([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ["<", ">"],
]);

const CLOSE_TO_OPEN = new Map<string, string>(
  [...OPEN_TO_CLOSE].map(([open, close]) => [close, open]),
);

function scanForward(
  model: BracketMatchModel,
  start: EditorPosition,
  open: string,
  close: string,
): EditorPosition | null {
  let depth = 1;
  for (
    let lineNumber = start.lineNumber;
    lineNumber <= model.getLineCount();
    lineNumber += 1
  ) {
    const line = model.getLineContent(lineNumber);
    const startIndex = lineNumber === start.lineNumber ? start.column : 0;
    for (let index = startIndex; index < line.length; index += 1) {
      const char = line[index];
      if (char === open) {
        depth += 1;
      } else if (char === close) {
        depth -= 1;
        if (depth === 0) {
          return { lineNumber, column: index + 1 };
        }
      }
    }
  }
  return null;
}

function scanBackward(
  model: BracketMatchModel,
  start: EditorPosition,
  open: string,
  close: string,
): EditorPosition | null {
  let depth = 1;
  for (let lineNumber = start.lineNumber; lineNumber >= 1; lineNumber -= 1) {
    const line = model.getLineContent(lineNumber);
    const startIndex =
      lineNumber === start.lineNumber ? start.column - 2 : line.length - 1;
    for (let index = startIndex; index >= 0; index -= 1) {
      const char = line[index];
      if (char === close) {
        depth += 1;
      } else if (char === open) {
        depth -= 1;
        if (depth === 0) {
          return { lineNumber, column: index + 1 };
        }
      }
    }
  }
  return null;
}

export function findMatchingBracketPosition(
  editor: BracketMatchEditor,
): EditorPosition | null {
  const model = editor.getModel();
  const position = editor.getPosition();
  if (!model || !position) {
    return null;
  }

  const line = model.getLineContent(position.lineNumber);
  const char = line[position.column - 1];
  const close = OPEN_TO_CLOSE.get(char);
  if (close) {
    return scanForward(model, position, char, close);
  }

  const open = CLOSE_TO_OPEN.get(char);
  if (open) {
    return scanBackward(model, position, open, char);
  }

  return null;
}

export function jumpToMatchingBracket(editor: BracketMatchEditor): boolean {
  const target = findMatchingBracketPosition(editor);
  if (!target) {
    return false;
  }
  editor.setPosition(target);
  editor.revealPositionInCenterIfOutsideViewport?.(target);
  editor.focus?.();
  return true;
}
