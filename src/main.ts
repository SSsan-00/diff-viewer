import "./style.css";
import "monaco-editor/min/vs/editor/editor.main.css";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { setupMonacoWorkers } from "./monaco/monacoWorkers";
import { diffLines } from "./diffEngine/diffLines";
import { pairReplace } from "./diffEngine/pairReplace";
import { diffInline } from "./diffEngine/diffInline";
import type { PairedOp } from "./diffEngine/types";
import { ScrollSyncController } from "./scrollSync/ScrollSyncController";
import { getDiffBlockStarts, mapRowToLineNumbers } from "./diffEngine/diffBlocks";
import { decodeArrayBuffer, type FileEncoding } from "./file/decode";
import {
  createLineNumberFormatter,
  getLineSegmentInfo,
  type LineSegment,
} from "./file/lineNumbering";
import { buildFoldRanges, findFoldContainingRow, type FoldRange } from "./diffEngine/folding";
import {
  addAnchor,
  diffWithAnchors,
  removeAnchorByLeft,
  removeAnchorByRight,
  validateAnchors,
  type Anchor,
} from "./diffEngine/anchors";
import { normalizeText } from "./diffEngine/normalize";
import { THIRD_PARTY_LICENSES } from "./licenses";
import { APP_TEMPLATE } from "./ui/template";
import { setupAnchorPanelToggle } from "./ui/anchorPanelToggle";
import { bindPaneClearButton } from "./ui/paneClear";

// Run once before creating any editor instances.
setupMonacoWorkers();

function attachLicenses(): void {
  if (document.getElementById("third-party-licenses")) {
    return;
  }
  const node = document.createElement("script");
  node.id = "third-party-licenses";
  node.type = "application/json";
  node.textContent = JSON.stringify({ thirdPartyLicenses: THIRD_PARTY_LICENSES });
  document.head.appendChild(node);
}

attachLicenses();

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container is missing.");
}

app.innerHTML = APP_TEMPLATE;
setupAnchorPanelToggle(document);

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const leftContainer = getRequiredElement<HTMLDivElement>("#left-editor");
const rightContainer = getRequiredElement<HTMLDivElement>("#right-editor");
const leftPane = getRequiredElement<HTMLElement>("#left-pane");
const rightPane = getRequiredElement<HTMLElement>("#right-pane");
const leftMessage = getRequiredElement<HTMLDivElement>("#left-message");
const rightMessage = getRequiredElement<HTMLDivElement>("#right-message");
const leftEncodingSelect = getRequiredElement<HTMLSelectElement>("#left-encoding");
const rightEncodingSelect = getRequiredElement<HTMLSelectElement>("#right-encoding");
const leftFileInput = getRequiredElement<HTMLInputElement>("#left-file");
const rightFileInput = getRequiredElement<HTMLInputElement>("#right-file");
const leftFileButton = getRequiredElement<HTMLButtonElement>("#left-file-button");
const rightFileButton = getRequiredElement<HTMLButtonElement>("#right-file-button");
const anchorMessage = getRequiredElement<HTMLDivElement>("#anchor-message");
const anchorWarning = getRequiredElement<HTMLDivElement>("#anchor-warning");
const anchorList = getRequiredElement<HTMLUListElement>("#anchor-list");
const clearButton = getRequiredElement<HTMLButtonElement>("#clear");
const leftClearButton = getRequiredElement<HTMLButtonElement>("#left-clear");
const rightClearButton = getRequiredElement<HTMLButtonElement>("#right-clear");

const leftInitial = `// Left sample (47 lines)
const config = {
  app: "diff-viewer",
  version: "0.1.0",
  features: ["diff", "anchors", "folding"],
};

function greet(name) {
  return "Hello, " + name;
}

function add(a, b) {
  return a + b;
}

function sumList(values) {
  return values.reduce((total, value) => total + value, 0);
}

function format(value) {
  return \`[\${value}]\`;
}

const numbers = [1, 2, 3, 4];
const total = sumList(numbers);

const message = greet("World");
const count = add(2, 3);

const output = [];
output.push(format(message));
output.push(format(total));

if (count > 3) {
  console.log(output.join(" | "));
} else {
  console.log("Small count");
}

for (let i = 0; i < 3; i += 1) {
  console.log("step", i);
}

const flags = new Map();
flags.set("ready", true);

export { config, greet, add, sumList };
`;

const rightInitial = `// Right sample (47 lines)
const config = {
  app: "diff-viewer",
  version: "0.1.1",
  features: ["diff", "anchors", "folding", "drop"],
};

function greet(name) {
  return "Hello, " + name + "!";
}

function add(a, b) {
  return a + b;
}

function sumList(values) {
  return values.reduce((total, value) => total + value, 0);
}

function format(value) {
  return \`{\${value}}\`;
}

const numbers = [1, 2, 3, 4, 5];
const total = sumList(numbers);

const message = greet("Codex");
const count = add(2, 4);

const output = [];
output.push(format(message));
output.push(format(total));

if (count > 3) {
  console.log(output.join(" / "));
} else {
  console.log("Small count");
}

for (let i = 0; i < 4; i += 1) {
  console.log("step", i);
}

const flags = new Map();
flags.set("ready", true);

export { config, greet, add, sumList };
`;

const leftEditor = monaco.editor.create(leftContainer, {
  value: leftInitial,
  language: "plaintext",
  theme: "vs",
  automaticLayout: true,
  glyphMargin: true,
  minimap: { enabled: false },
  lineNumbers: "on",
});

const rightEditor = monaco.editor.create(rightContainer, {
  value: rightInitial,
  language: "plaintext",
  theme: "vs",
  automaticLayout: true,
  glyphMargin: true,
  minimap: { enabled: false },
  lineNumbers: "on",
});

function setPaneMessage(target: HTMLDivElement, message: string, isError: boolean) {
  target.textContent = message;
  target.classList.toggle("is-error", isError);
}

function appendTextToEditor(
  editor: monaco.editor.IStandaloneCodeEditor,
  text: string,
) {
  const current = editor.getValue();
  if (!current) {
    editor.setValue(text);
    return;
  }
  const separator = current.endsWith("\n") ? "" : "\n";
  editor.setValue(current + separator + text);
}

function getAppendStartLine(
  currentValue: string,
  currentLineCount: number,
): number {
  if (!currentValue) {
    return 1;
  }
  return currentLineCount + (currentValue.endsWith("\n") ? 0 : 1);
}

function updateLineNumbers(
  editor: monaco.editor.IStandaloneCodeEditor,
  segments: LineSegment[],
) {
  editor.updateOptions({
    lineNumbers: segments.length === 0 ? "on" : createLineNumberFormatter(segments),
  });
}

async function appendFilesToEditor(
  files: FileList | File[],
  encoding: FileEncoding,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  segments: LineSegment[],
) {
  const fileList = Array.from(files);
  if (fileList.length === 0) {
    setPaneMessage(messageTarget, "ファイルが見つかりませんでした", true);
    return;
  }

  let currentFileName = "";
  try {
    const nextSegments: LineSegment[] = [...segments];
    const parts: string[] = [];
    let currentValue = editor.getValue();
    let currentLineCount =
      editor.getModel()?.getLineCount() ?? currentValue.split("\n").length;

    const baseFileIndex = nextSegments.length;
    for (const [index, file] of fileList.entries()) {
      const lastSegment = nextSegments[nextSegments.length - 1];
      if (lastSegment?.endsWithNewline) {
        lastSegment.lineCount = Math.max(1, lastSegment.lineCount - 1);
        lastSegment.endsWithNewline = false;
      }
      currentFileName = file.name;
      const fileIndex = baseFileIndex + index + 1;
      const buffer = await file.arrayBuffer();
      const text = normalizeText(decodeArrayBuffer(buffer, encoding));
      const endsWithNewline = text.endsWith("\n");
      const startLine = getAppendStartLine(currentValue, currentLineCount);
      const lineCount = text.split("\n").length;

      parts.push(text);
      nextSegments.push({
        startLine,
        lineCount,
        fileIndex,
        fileName: file.name,
        endsWithNewline,
      });
      currentValue = currentValue
        ? currentValue + (currentValue.endsWith("\n") ? "" : "\n") + text
        : text;
      currentLineCount = currentValue.split("\n").length;
    }

    parts.forEach((text) => appendTextToEditor(editor, text));
    segments.length = 0;
    segments.push(...nextSegments);
    updateLineNumbers(editor, segments);
    const label =
      fileList.length === 1
        ? fileList[0].name
        : `${fileList[0].name} (+${fileList.length - 1})`;
    setPaneMessage(messageTarget, `読み込み完了: ${label}`, false);
    recalcDiff();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "読み込みに失敗しました";
    console.error(error);
    const detail = currentFileName ? `${message} (${currentFileName})` : message;
    setPaneMessage(messageTarget, detail, true);
  }
}

function bindDropZone(
  zone: HTMLElement,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  encodingSelect: HTMLSelectElement,
  segments: LineSegment[],
) {
  zone.addEventListener("dragover", (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.add("is-dragover");
  });

  zone.addEventListener("dragleave", (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && zone.contains(nextTarget)) {
      return;
    }
    zone.classList.remove("is-dragover");
  });

  zone.addEventListener("drop", (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("is-dragover");

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      setPaneMessage(messageTarget, "ファイルが見つかりませんでした", true);
      return;
    }

    const encoding = encodingSelect.value as FileEncoding;
    void appendFilesToEditor(files, encoding, editor, messageTarget, segments);
  });
}

const leftSegments: LineSegment[] = [];
const rightSegments: LineSegment[] = [];

bindDropZone(leftPane, leftEditor, leftMessage, leftEncodingSelect, leftSegments);
bindDropZone(rightPane, rightEditor, rightMessage, rightEncodingSelect, rightSegments);

function bindFilePicker(
  input: HTMLInputElement,
  button: HTMLButtonElement,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  encodingSelect: HTMLSelectElement,
  segments: LineSegment[],
) {
  button.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("change", () => {
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    const encoding = encodingSelect.value as FileEncoding;
    void appendFilesToEditor(files, encoding, editor, messageTarget, segments);
    input.value = "";
  });
}

bindFilePicker(
  leftFileInput,
  leftFileButton,
  leftEditor,
  leftMessage,
  leftEncodingSelect,
  leftSegments,
);
bindFilePicker(
  rightFileInput,
  rightFileButton,
  rightEditor,
  rightMessage,
  rightEncodingSelect,
  rightSegments,
);

function preventWindowDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
}

window.addEventListener("dragover", preventWindowDrop);
window.addEventListener("drop", preventWindowDrop);

const scrollSync = new ScrollSyncController(
  {
    onDidScrollChange: (handler) => {
      leftEditor.onDidScrollChange((event) =>
        handler({ scrollTop: event.scrollTop, scrollLeft: event.scrollLeft }),
      );
    },
    setScrollTop: (value) => leftEditor.setScrollTop(value),
    setScrollLeft: (value) => leftEditor.setScrollLeft(value),
  },
  {
    onDidScrollChange: (handler) => {
      rightEditor.onDidScrollChange((event) =>
        handler({ scrollTop: event.scrollTop, scrollLeft: event.scrollLeft }),
      );
    },
    setScrollTop: (value) => rightEditor.setScrollTop(value),
    setScrollLeft: (value) => rightEditor.setScrollLeft(value),
  },
);

function isGutterClick(event: monaco.editor.IEditorMouseEvent): boolean {
  const targetType = event.target.type;
  return (
    targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
    targetType === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
  );
}

leftEditor.onMouseDown((event) => {
  if (!isGutterClick(event)) {
    return;
  }
  const lineNumber = event.target.position?.lineNumber;
  if (!lineNumber) {
    return;
  }
  const leftLineNo = lineNumber - 1;
  const removal = removeAnchorByLeft(manualAnchors, leftLineNo);
  if (removal.removed) {
    manualAnchors = removal.next;
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor removed: ${formatAnchor(removal.removed)}`);
  } else if (autoAnchor && autoAnchor.leftLineNo === leftLineNo) {
    suppressedAutoAnchorKey = autoAnchorKey(autoAnchor);
    autoAnchor = null;
    if (selectedAnchorKey === suppressedAutoAnchorKey) {
      selectedAnchorKey = null;
    }
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage("Auto anchor removed.");
  } else if (pendingRightLineNo !== null) {
    const anchor = { leftLineNo, rightLineNo: pendingRightLineNo };
    manualAnchors = addAnchor(manualAnchors, anchor);
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor added: ${formatAnchor(anchor)}`);
    recalcDiff();
  } else {
    pendingLeftLineNo = leftLineNo;
    setAnchorMessage("左行を選択しました。右行を選んでください。");
  }
  updatePendingAnchorDecoration();
  const validation = validateAnchors(
    manualAnchors,
    getNormalizedLineCount(leftEditor.getValue()),
    getNormalizedLineCount(rightEditor.getValue()),
  );
  updateAnchorWarning(validation.invalid);
  renderAnchors(validation.invalid, validation.valid);
});

rightEditor.onMouseDown((event) => {
  if (!isGutterClick(event)) {
    return;
  }
  const lineNumber = event.target.position?.lineNumber;
  if (!lineNumber) {
    return;
  }
  const rightLineNo = lineNumber - 1;
  const removal = removeAnchorByRight(manualAnchors, rightLineNo);
  if (removal.removed) {
    manualAnchors = removal.next;
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor removed: ${formatAnchor(removal.removed)}`);
  } else if (autoAnchor && autoAnchor.rightLineNo === rightLineNo) {
    suppressedAutoAnchorKey = autoAnchorKey(autoAnchor);
    autoAnchor = null;
    if (selectedAnchorKey === suppressedAutoAnchorKey) {
      selectedAnchorKey = null;
    }
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage("Auto anchor removed.");
  } else if (pendingLeftLineNo === null) {
    pendingRightLineNo = rightLineNo;
    setAnchorMessage("右行を選択しました。左行を選んでください。");
  } else {
    const leftLineNo = pendingLeftLineNo;
    const anchor = { leftLineNo, rightLineNo };
    manualAnchors = addAnchor(manualAnchors, anchor);
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor added: ${formatAnchor(anchor)}`);
    recalcDiff();
  }
  updatePendingAnchorDecoration();
  const validation = validateAnchors(
    manualAnchors,
    getNormalizedLineCount(leftEditor.getValue()),
    getNormalizedLineCount(rightEditor.getValue()),
  );
  updateAnchorWarning(validation.invalid);
  renderAnchors(validation.invalid, validation.valid);
});

let leftDecorationIds: string[] = [];
let rightDecorationIds: string[] = [];
let leftZoneIds: string[] = [];
let rightZoneIds: string[] = [];
let pairedOps: PairedOp[] = [];
let diffBlockStarts: number[] = [];
let currentBlockIndex = 0;
let leftFocusDecorationIds: string[] = [];
let rightFocusDecorationIds: string[] = [];
let foldEnabled = false;
let foldRanges: FoldRange[] = [];
let leftFoldZoneIds: string[] = [];
let rightFoldZoneIds: string[] = [];
const expandedFoldStarts = new Set<number>();
let manualAnchors: Anchor[] = [];
let autoAnchor: Anchor | null = null;
let suppressedAutoAnchorKey: string | null = null;
let pendingLeftLineNo: number | null = null;
let pendingRightLineNo: number | null = null;
let leftAnchorDecorationIds: string[] = [];
let rightAnchorDecorationIds: string[] = [];
let selectedAnchorKey: string | null = null;
let pendingLeftDecorationIds: string[] = [];
let pendingRightDecorationIds: string[] = [];

type ZoneSide = "insert" | "delete";

type ViewZoneSpec = {
  afterLineNumber: number;
  heightInLines: number;
  className: string;
  label?: string;
};

type FoldZoneSpec = {
  afterLineNumber: number;
  heightInLines: number;
  className: string;
  label: string;
  onClick: () => void;
};

const foldOptions = {
  threshold: 8,
  keepHead: 3,
  keepTail: 3,
};

function setAnchorMessage(message: string) {
  anchorMessage.textContent = message;
}

type FileLineInfo = {
  fileIndex: number | null;
  fileName?: string;
  localLine: number;
};

function getFileLineInfo(segments: LineSegment[], lineNo: number): FileLineInfo {
  const info = getLineSegmentInfo(segments, lineNo + 1);
  if (!info) {
    return { fileIndex: null, localLine: lineNo + 1 };
  }
  return { fileIndex: info.fileIndex, fileName: info.fileName, localLine: info.localLine };
}

function formatLineWithFile(side: "L" | "R", info: FileLineInfo): string {
  if (info.fileIndex === null) {
    return `${side}${info.localLine}`;
  }
  return `${side}${info.localLine}[F${info.fileIndex}]`;
}

function formatAnchor(anchor: Anchor): string {
  const leftInfo = getFileLineInfo(leftSegments, anchor.leftLineNo);
  const rightInfo = getFileLineInfo(rightSegments, anchor.rightLineNo);
  return `${formatLineWithFile("L", leftInfo)} ↔ ${formatLineWithFile("R", rightInfo)}`;
}

function anchorKey(anchor: Anchor): string {
  return `${anchor.leftLineNo}:${anchor.rightLineNo}`;
}

function manualAnchorKey(anchor: Anchor): string {
  return `manual:${anchorKey(anchor)}`;
}

function autoAnchorKey(anchor: Anchor): string {
  return `auto:${anchorKey(anchor)}`;
}

function updatePendingAnchorDecoration() {
  if (pendingLeftLineNo === null) {
    pendingLeftDecorationIds = leftEditor.deltaDecorations(pendingLeftDecorationIds, []);
  } else {
    pendingLeftDecorationIds = leftEditor.deltaDecorations(pendingLeftDecorationIds, [
      {
        range: new monaco.Range(pendingLeftLineNo + 1, 1, pendingLeftLineNo + 1, 1),
        options: {
          isWholeLine: true,
          className: "anchor-pending-line",
          glyphMarginClassName: "anchor-pending-glyph",
        },
      },
    ]);
  }

  if (pendingRightLineNo === null) {
    pendingRightDecorationIds = rightEditor.deltaDecorations(
      pendingRightDecorationIds,
      [],
    );
  } else {
    pendingRightDecorationIds = rightEditor.deltaDecorations(pendingRightDecorationIds, [
      {
        range: new monaco.Range(pendingRightLineNo + 1, 1, pendingRightLineNo + 1, 1),
        options: {
          isWholeLine: true,
          className: "anchor-pending-line",
          glyphMarginClassName: "anchor-pending-glyph",
        },
      },
    ]);
  }
}

function updateAnchorWarning(invalid: { anchor: Anchor; reasons: string[] }[]) {
  if (invalid.length === 0) {
    anchorWarning.textContent = "";
    return;
  }

  const message = invalid
    .map((item) => {
      const leftInfo = getFileLineInfo(leftSegments, item.anchor.leftLineNo);
      const rightInfo = getFileLineInfo(rightSegments, item.anchor.rightLineNo);
      return `${formatLineWithFile("L", leftInfo)} ↔ ${formatLineWithFile("R", rightInfo)}: ${item.reasons.join(" / ")}`;
    })
    .join(" | ");
  anchorWarning.textContent = `無効なアンカーがあります: ${message}`;
}

type AnchorEntry = {
  anchor: Anchor;
  source: "manual" | "auto";
};

function renderAnchors(
  invalid: { anchor: Anchor; reasons: string[] }[],
  valid: Anchor[],
) {
  anchorList.innerHTML = "";
  const entries: AnchorEntry[] = [];
  if (autoAnchor) {
    entries.push({ anchor: autoAnchor, source: "auto" });
  }
  manualAnchors.forEach((anchor) => {
    entries.push({ anchor, source: "manual" });
  });
  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "anchor-empty";
    empty.textContent = "アンカーはありません";
    anchorList.appendChild(empty);
    return;
  }

  const invalidMap = new Map<Anchor, string>();
  invalid.forEach((item) => {
    invalidMap.set(item.anchor, item.reasons.join(" / "));
  });
  const validSet = new Set(valid);

  entries.forEach((entry) => {
    const anchor = entry.anchor;
    const item = document.createElement("li");
    item.className = "anchor-item";
    if (entry.source === "auto") {
      item.classList.add("is-auto");
    }
    const entryKey =
      entry.source === "auto" ? autoAnchorKey(anchor) : manualAnchorKey(anchor);
    if (selectedAnchorKey === entryKey) {
      item.classList.add("is-selected");
    }
    const leftInfo = getFileLineInfo(leftSegments, anchor.leftLineNo);
    const rightInfo = getFileLineInfo(rightSegments, anchor.rightLineNo);
    const reason = entry.source === "manual" ? invalidMap.get(anchor) : undefined;

    const label = document.createElement("span");
    label.className = "anchor-link";
    if (entry.source === "auto") {
      label.classList.add("anchor-auto");
    }
    const createLinePart = (side: "L" | "R", info: FileLineInfo) => {
      const wrapper = document.createElement("span");
      wrapper.className = "anchor-side";

      const lineText = document.createElement("span");
      lineText.className = "anchor-line";
      lineText.textContent = `${side}${info.localLine}`;
      wrapper.appendChild(lineText);

      if (info.fileIndex !== null) {
        const badge = document.createElement("span");
        const paletteIndex = ((info.fileIndex - 1) % 4) + 1;
        badge.className = `anchor-file-badge file-index-${paletteIndex}`;
        badge.textContent = `F${info.fileIndex}`;
        if (info.fileName) {
          badge.title = info.fileName;
        }
        wrapper.appendChild(badge);
      }

      return wrapper;
    };

    if (entry.source === "auto") {
      const prefix = document.createElement("span");
      prefix.className = "anchor-auto-prefix";
      prefix.textContent = "AUTO:DOCTYPE";
      label.appendChild(prefix);
    }

    label.appendChild(createLinePart("L", leftInfo));
    const separator = document.createElement("span");
    separator.className = "anchor-separator";
    separator.textContent = "↔";
    label.appendChild(separator);
    label.appendChild(createLinePart("R", rightInfo));

    if (reason) {
      label.classList.add("anchor-invalid");
      const reasonText = document.createElement("span");
      reasonText.className = "anchor-reason";
      reasonText.textContent = `（無効: ${reason}）`;
      label.appendChild(reasonText);
    } else if (entry.source === "manual" && !validSet.has(anchor)) {
      label.classList.add("anchor-disabled");
    }

    const canJump = entry.source === "auto" || validSet.has(anchor);
    if (canJump) {
      item.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest(".anchor-remove")) {
          return;
        }
        selectedAnchorKey = entryKey;
        renderAnchors(invalid, valid);
        leftEditor.revealLineInCenter(anchor.leftLineNo + 1);
        rightEditor.revealLineInCenter(anchor.rightLineNo + 1);
        focusDiffLines(anchor.leftLineNo, anchor.rightLineNo);
        setAnchorMessage(`Anchor jump: ${formatAnchor(anchor)}`);
      });
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "anchor-remove";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeButton.blur();
      if (entry.source === "auto") {
        suppressedAutoAnchorKey = autoAnchorKey(anchor);
        autoAnchor = null;
        if (selectedAnchorKey === entryKey) {
          selectedAnchorKey = null;
        }
        setAnchorMessage("Auto anchor removed.");
        recalcDiff();
      } else {
        const manualIndex = manualAnchors.indexOf(anchor);
        if (manualIndex === -1) {
          return;
        }
        const removed = manualAnchors[manualIndex];
        manualAnchors = manualAnchors.filter((_, anchorIndex) => anchorIndex !== manualIndex);
        if (selectedAnchorKey === entryKey) {
          selectedAnchorKey = null;
        }
        setAnchorMessage(`Anchor removed: ${formatAnchor(removed)}`);
        recalcDiff();
      }
      const validation = validateAnchors(
        manualAnchors,
        getNormalizedLineCount(leftEditor.getValue()),
        getNormalizedLineCount(rightEditor.getValue()),
      );
      updateAnchorWarning(validation.invalid);
      renderAnchors(validation.invalid, validation.valid);
    });

    item.appendChild(label);
    item.appendChild(removeButton);
    anchorList.appendChild(item);
  });
}

function getNormalizedLineCount(text: string): number {
  return normalizeText(text).split("\n").length;
}

function findDoctypeLineIndex(text: string): number {
  const lines = normalizeText(text).split("\n");
  const pattern = /<(!|！)DOCTYPE/i;
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return index;
    }
  }
  return -1;
}

function getAutoDoctypeAnchor(leftText: string, rightText: string): Anchor | null {
  const leftIndex = findDoctypeLineIndex(leftText);
  const rightIndex = findDoctypeLineIndex(rightText);
  if (leftIndex === -1 || rightIndex === -1) {
    return null;
  }
  return { leftLineNo: leftIndex, rightLineNo: rightIndex };
}

function anchorsEqual(left: Anchor, right: Anchor): boolean {
  return left.leftLineNo === right.leftLineNo && left.rightLineNo === right.rightLineNo;
}

function addLineDecoration(
  target: monaco.editor.IModelDeltaDecoration[],
  lineNo: number,
  className: string,
) {
  target.push({
    range: new monaco.Range(lineNo + 1, 1, lineNo + 1, 1),
    options: { isWholeLine: true, className },
  });
}

function addInlineDecorations(
  target: monaco.editor.IModelDeltaDecoration[],
  lineNo: number,
  ranges: { start: number; end: number }[],
  className: string,
) {
  for (const range of ranges) {
    if (range.start >= range.end) {
      continue;
    }
    target.push({
      range: new monaco.Range(lineNo + 1, range.start + 1, lineNo + 1, range.end + 1),
      options: { inlineClassName: className },
    });
  }
}

function buildDecorations(ops: PairedOp[]): {
  left: monaco.editor.IModelDeltaDecoration[];
  right: monaco.editor.IModelDeltaDecoration[];
} {
  const left: monaco.editor.IModelDeltaDecoration[] = [];
  const right: monaco.editor.IModelDeltaDecoration[] = [];

  for (const op of ops) {
    if (op.type === "insert" && op.rightLineNo !== undefined) {
      addLineDecoration(right, op.rightLineNo, "line-insert");
      continue;
    }

    if (op.type === "delete" && op.leftLineNo !== undefined) {
      addLineDecoration(left, op.leftLineNo, "line-delete");
      continue;
    }

    if (op.type === "replace" && op.leftLineNo !== undefined && op.rightLineNo !== undefined) {
      addLineDecoration(left, op.leftLineNo, "line-replace");
      addLineDecoration(right, op.rightLineNo, "line-replace");

      const inline = diffInline(op.leftLine ?? "", op.rightLine ?? "");
      addInlineDecorations(left, op.leftLineNo, inline.leftRanges, "inline-delete");
      addInlineDecorations(right, op.rightLineNo, inline.rightRanges, "inline-insert");
    }
  }

  return { left, right };
}

function buildAnchorDecorations(
  validAnchors: Anchor[],
  autoAnchorTarget: Anchor | null,
): {
  left: monaco.editor.IModelDeltaDecoration[];
  right: monaco.editor.IModelDeltaDecoration[];
} {
  const left: monaco.editor.IModelDeltaDecoration[] = [];
  const right: monaco.editor.IModelDeltaDecoration[] = [];

  const pushAnchor = (anchor: Anchor, lineClass: string, glyphClass: string) => {
    const leftRange = new monaco.Range(anchor.leftLineNo + 1, 1, anchor.leftLineNo + 1, 1);
    left.push({
      range: leftRange,
      options: {
        isWholeLine: true,
        className: lineClass,
        glyphMarginClassName: glyphClass,
      },
    });

    const rightRange = new monaco.Range(
      anchor.rightLineNo + 1,
      1,
      anchor.rightLineNo + 1,
      1,
    );
    right.push({
      range: rightRange,
      options: {
        isWholeLine: true,
        className: lineClass,
        glyphMarginClassName: glyphClass,
      },
    });
  };

  validAnchors.forEach((anchor) => {
    pushAnchor(anchor, "diff-anchor-line", "diff-anchor-glyph");
  });

  if (autoAnchorTarget) {
    pushAnchor(autoAnchorTarget, "diff-anchor-auto-line", "diff-anchor-auto-glyph");
  }

  return { left, right };
}

function buildViewZones(ops: PairedOp[]): {
  left: ViewZoneSpec[];
  right: ViewZoneSpec[];
} {
  const left: ViewZoneSpec[] = [];
  const right: ViewZoneSpec[] = [];
  let consumedLeftLines = 0;
  let consumedRightLines = 0;

  const pushZone = (
    target: ViewZoneSpec[],
    side: ZoneSide,
    afterLineNumber: number,
    heightInLines: number,
  ) => {
    if (heightInLines <= 0) {
      return;
    }
    const className = side === "insert" ? "diff-zone-insert" : "diff-zone-delete";
    target.push({ afterLineNumber, heightInLines, className });
  };

  const appendOrExtendZone = (
    target: ViewZoneSpec[],
    side: ZoneSide,
    afterLineNumber: number,
    heightInLines: number,
  ) => {
    const className = side === "insert" ? "diff-zone-insert" : "diff-zone-delete";
    const last = target[target.length - 1];
    if (
      last &&
      last.className === className &&
      last.afterLineNumber === afterLineNumber
    ) {
      last.heightInLines += heightInLines;
      return;
    }
    pushZone(target, side, afterLineNumber, heightInLines);
  };

  for (const op of ops) {
    if (op.type === "equal" || op.type === "replace") {
      consumedLeftLines += 1;
      consumedRightLines += 1;
      continue;
    }

    if (op.type === "insert") {
      consumedRightLines += 1;
      const afterLineNumber = Math.max(consumedLeftLines, 0);
      appendOrExtendZone(left, "insert", afterLineNumber, 1);
      continue;
    }

    if (op.type === "delete") {
      consumedLeftLines += 1;
      const afterLineNumber = Math.max(consumedRightLines, 0);
      appendOrExtendZone(right, "delete", afterLineNumber, 1);
    }
  }

  return { left, right };
}

function buildFileBoundaryZones(segments: LineSegment[]): ViewZoneSpec[] {
  const zones: ViewZoneSpec[] = [];
  const gapLines = 3;

  for (const segment of segments) {
    if (segment.startLine <= 1) {
      continue;
    }
    const paletteIndex = ((segment.fileIndex - 1) % 4) + 1;
    const label =
      segment.fileName && segment.fileName.length > 0
        ? `File ${segment.fileIndex}: ${segment.fileName}`
        : `File ${segment.fileIndex}`;
    zones.push({
      afterLineNumber: segment.startLine - 1,
      heightInLines: gapLines,
      className: `file-boundary-zone file-index-${paletteIndex}`,
      label,
    });
  }

  return zones;
}

function applyViewZones(
  editor: monaco.editor.IStandaloneCodeEditor,
  currentZoneIds: string[],
  zones: ViewZoneSpec[],
): string[] {
  const nextZoneIds: string[] = [];

  editor.changeViewZones((accessor: monaco.editor.IViewZoneChangeAccessor) => {
    for (const zoneId of currentZoneIds) {
      accessor.removeZone(zoneId);
    }

    for (const zone of zones) {
      const domNode = document.createElement("div");
      domNode.className = zone.className;
      if (zone.label) {
        domNode.textContent = zone.label;
      }
      const zoneId = accessor.addZone({
        afterLineNumber: zone.afterLineNumber,
        heightInLines: zone.heightInLines,
        domNode,
      });
      nextZoneIds.push(zoneId);
    }
  });

  return nextZoneIds;
}

function applyFoldZones(
  editor: monaco.editor.IStandaloneCodeEditor,
  currentZoneIds: string[],
  zones: FoldZoneSpec[],
): string[] {
  const nextZoneIds: string[] = [];

  editor.changeViewZones((accessor: monaco.editor.IViewZoneChangeAccessor) => {
    for (const zoneId of currentZoneIds) {
      accessor.removeZone(zoneId);
    }

    for (const zone of zones) {
      const domNode = document.createElement("div");
      domNode.className = zone.className;
      domNode.textContent = zone.label;
      domNode.addEventListener("click", zone.onClick);
      const zoneId = accessor.addZone({
        afterLineNumber: zone.afterLineNumber,
        heightInLines: zone.heightInLines,
        domNode,
      });
      nextZoneIds.push(zoneId);
    }
  });

  return nextZoneIds;
}

function buildHiddenAreas(folds: FoldRange[]): {
  left: monaco.IRange[];
  right: monaco.IRange[];
} {
  const left: monaco.IRange[] = [];
  const right: monaco.IRange[] = [];

  for (const fold of folds) {
    if (expandedFoldStarts.has(fold.startRow)) {
      continue;
    }
    const startLines = mapRowToLineNumbers(pairedOps, fold.hiddenStartRow);
    const endLines = mapRowToLineNumbers(pairedOps, fold.hiddenEndRow);

    left.push(new monaco.Range(startLines.leftLineNo + 1, 1, endLines.leftLineNo + 1, 1));
    right.push(
      new monaco.Range(startLines.rightLineNo + 1, 1, endLines.rightLineNo + 1, 1),
    );
  }

  return { left, right };
}

function buildFoldZones(folds: FoldRange[]): { left: FoldZoneSpec[]; right: FoldZoneSpec[] } {
  const left: FoldZoneSpec[] = [];
  const right: FoldZoneSpec[] = [];

  for (const fold of folds) {
    if (expandedFoldStarts.has(fold.startRow)) {
      continue;
    }
    const label = `... 省略（${fold.hiddenCount}行） ...`;
    const startLines = mapRowToLineNumbers(pairedOps, fold.hiddenStartRow);
    const onClick = () => {
      expandedFoldStarts.add(fold.startRow);
      applyFolding();
    };

    left.push({
      afterLineNumber: startLines.leftLineNo,
      heightInLines: 1,
      className: "diff-fold-placeholder",
      label,
      onClick,
    });
    right.push({
      afterLineNumber: startLines.rightLineNo,
      heightInLines: 1,
      className: "diff-fold-placeholder",
      label,
      onClick,
    });
  }

  return { left, right };
}

function applyFolding() {
  if (!foldEnabled) {
    setEditorHiddenAreas(leftEditor, []);
    setEditorHiddenAreas(rightEditor, []);
    leftFoldZoneIds = applyFoldZones(leftEditor, leftFoldZoneIds, []);
    rightFoldZoneIds = applyFoldZones(rightEditor, rightFoldZoneIds, []);
    return;
  }

  const hiddenAreas = buildHiddenAreas(foldRanges);
  setEditorHiddenAreas(leftEditor, hiddenAreas.left);
  setEditorHiddenAreas(rightEditor, hiddenAreas.right);

  const zones = buildFoldZones(foldRanges);
  leftFoldZoneIds = applyFoldZones(leftEditor, leftFoldZoneIds, zones.left);
  rightFoldZoneIds = applyFoldZones(rightEditor, rightFoldZoneIds, zones.right);
}

function setEditorHiddenAreas(
  editor: monaco.editor.IStandaloneCodeEditor,
  ranges: monaco.IRange[],
) {
  // Monaco's type definitions may not expose setHiddenAreas, so we guard at runtime.
  const editorWithHidden = editor as monaco.editor.IStandaloneCodeEditor & {
    setHiddenAreas?: (areas: monaco.IRange[]) => void;
  };
  if (editorWithHidden.setHiddenAreas) {
    editorWithHidden.setHiddenAreas(ranges);
  } else {
    console.warn("setHiddenAreas is not available on this Monaco build.");
  }
}

function recalcDiff() {
  const leftText = leftEditor.getValue();
  const rightText = rightEditor.getValue();
  const validation = validateAnchors(
    manualAnchors,
    getNormalizedLineCount(leftText),
    getNormalizedLineCount(rightText),
  );

  if (validation.invalid.length > 0) {
    console.warn("無効なアンカーが検出されました:", validation.invalid);
  }

  let anchorsForDiff = validation.valid;
  autoAnchor = null;
  const autoCandidate = getAutoDoctypeAnchor(leftText, rightText);
  if (autoCandidate) {
    const candidateKey = autoAnchorKey(autoCandidate);
    if (suppressedAutoAnchorKey && suppressedAutoAnchorKey !== candidateKey) {
      suppressedAutoAnchorKey = null;
    }
    if (suppressedAutoAnchorKey !== candidateKey) {
      const candidate = addAnchor(validation.valid, autoCandidate);
      const candidateValidation = validateAnchors(
        candidate,
        getNormalizedLineCount(leftText),
        getNormalizedLineCount(rightText),
      );
      const autoValid =
        candidateValidation.valid.some((anchor) =>
          anchorsEqual(anchor, autoCandidate),
        ) &&
        candidateValidation.invalid.every(
          (issue) => !anchorsEqual(issue.anchor, autoCandidate),
        );
      if (autoValid) {
        anchorsForDiff = candidateValidation.valid;
        autoAnchor = autoCandidate;
      } else {
        console.warn("Auto DOCTYPE anchor skipped due to conflicts.");
      }
    }
  }

  updateAnchorWarning(validation.invalid);
  renderAnchors(validation.invalid, validation.valid);

  if (anchorsForDiff.length > 0) {
    pairedOps = diffWithAnchors(leftText, rightText, anchorsForDiff);
  } else {
    pairedOps = pairReplace(diffLines(leftText, rightText));
  }

  diffBlockStarts = getDiffBlockStarts(pairedOps);
  currentBlockIndex = 0;
  foldRanges = buildFoldRanges(pairedOps, foldOptions);
  expandedFoldStarts.clear();
  const { left, right } = buildDecorations(pairedOps);
  const anchorDecorations = buildAnchorDecorations(validation.valid, autoAnchor);
  const zones = buildViewZones(pairedOps);
  const leftFileZones = buildFileBoundaryZones(leftSegments);
  const rightFileZones = buildFileBoundaryZones(rightSegments);

  leftDecorationIds = leftEditor.deltaDecorations(leftDecorationIds, left);
  rightDecorationIds = rightEditor.deltaDecorations(rightDecorationIds, right);
  leftAnchorDecorationIds = leftEditor.deltaDecorations(
    leftAnchorDecorationIds,
    anchorDecorations.left,
  );
  rightAnchorDecorationIds = rightEditor.deltaDecorations(
    rightAnchorDecorationIds,
    anchorDecorations.right,
  );
  updatePendingAnchorDecoration();
  leftZoneIds = applyViewZones(leftEditor, leftZoneIds, zones.left.concat(leftFileZones));
  rightZoneIds = applyViewZones(rightEditor, rightZoneIds, zones.right.concat(rightFileZones));
  updateDiffJumpButtons();
  applyFolding();
  focusDiffLines(null, null);
}

const recalcButton = document.querySelector<HTMLButtonElement>("#recalc");
recalcButton?.addEventListener("click", () => {
  recalcDiff();
});

bindPaneClearButton(leftClearButton, {
  editor: leftEditor,
  segments: leftSegments,
  updateLineNumbers,
  onAfterClear: () => {
    pendingLeftLineNo = null;
    updatePendingAnchorDecoration();
    recalcDiff();
  },
});

bindPaneClearButton(rightClearButton, {
  editor: rightEditor,
  segments: rightSegments,
  updateLineNumbers,
  onAfterClear: () => {
    pendingRightLineNo = null;
    updatePendingAnchorDecoration();
    recalcDiff();
  },
});

clearButton.addEventListener("click", () => {
  const confirmed = window.confirm("左右の内容とアンカーを全てクリアします。よろしいですか？");
  if (!confirmed) {
    return;
  }
  manualAnchors = [];
  autoAnchor = null;
  suppressedAutoAnchorKey = null;
  pendingLeftLineNo = null;
  pendingRightLineNo = null;
  selectedAnchorKey = null;
  leftEditor.setValue("");
  rightEditor.setValue("");
  leftSegments.length = 0;
  rightSegments.length = 0;
  updateLineNumbers(leftEditor, leftSegments);
  updateLineNumbers(rightEditor, rightSegments);
  recalcDiff();
  setAnchorMessage("アンカーを全てクリアしました。");
});

const syncToggle = document.querySelector<HTMLInputElement>("#sync-toggle");
syncToggle?.addEventListener("change", (event: Event) => {
  scrollSync.setEnabled((event.target as HTMLInputElement).checked);
});

const foldToggle = document.querySelector<HTMLInputElement>("#fold-toggle");
foldToggle?.addEventListener("change", (event: Event) => {
  foldEnabled = (event.target as HTMLInputElement).checked;
  applyFolding();
});

const prevButton = document.querySelector<HTMLButtonElement>("#diff-prev");
const nextButton = document.querySelector<HTMLButtonElement>("#diff-next");

function updateDiffJumpButtons() {
  const hasDiffs = diffBlockStarts.length > 0;
  if (prevButton) {
    prevButton.disabled = !hasDiffs;
  }
  if (nextButton) {
    nextButton.disabled = !hasDiffs;
  }
}

function focusDiffLines(
  leftLineNo: number | null,
  rightLineNo: number | null,
) {
  if (leftLineNo === null || rightLineNo === null) {
    leftFocusDecorationIds = leftEditor.deltaDecorations(
      leftFocusDecorationIds,
      [],
    );
    rightFocusDecorationIds = rightEditor.deltaDecorations(
      rightFocusDecorationIds,
      [],
    );
    return;
  }

  const leftDecorations: monaco.editor.IModelDeltaDecoration[] = [
    {
      range: new monaco.Range(leftLineNo + 1, 1, leftLineNo + 1, 1),
      options: {
        isWholeLine: true,
        className: "line-focus",
        glyphMarginClassName: "line-focus-glyph",
      },
    },
  ];
  const rightDecorations: monaco.editor.IModelDeltaDecoration[] = [
    {
      range: new monaco.Range(rightLineNo + 1, 1, rightLineNo + 1, 1),
      options: {
        isWholeLine: true,
        className: "line-focus",
        glyphMarginClassName: "line-focus-glyph",
      },
    },
  ];

  leftFocusDecorationIds = leftEditor.deltaDecorations(
    leftFocusDecorationIds,
    leftDecorations,
  );
  rightFocusDecorationIds = rightEditor.deltaDecorations(
    rightFocusDecorationIds,
    rightDecorations,
  );
}

function ensureRowVisible(rowIndex: number) {
  if (!foldEnabled) {
    return;
  }
  const fold = findFoldContainingRow(foldRanges, rowIndex);
  if (fold && !expandedFoldStarts.has(fold.startRow)) {
    expandedFoldStarts.add(fold.startRow);
    applyFolding();
  }
}

function revealBlock(index: number) {
  if (diffBlockStarts.length === 0) {
    return;
  }
  const rowIndex = diffBlockStarts[index];
  ensureRowVisible(rowIndex);
  const { leftLineNo, rightLineNo } = mapRowToLineNumbers(pairedOps, rowIndex);

  leftEditor.revealLineInCenter(leftLineNo + 1);
  rightEditor.revealLineInCenter(rightLineNo + 1);
  focusDiffLines(leftLineNo, rightLineNo);
}

prevButton?.addEventListener("click", () => {
  if (diffBlockStarts.length === 0) {
    return;
  }
  currentBlockIndex = Math.max(0, currentBlockIndex - 1);
  revealBlock(currentBlockIndex);
});

nextButton?.addEventListener("click", () => {
  if (diffBlockStarts.length === 0) {
    return;
  }
  currentBlockIndex = Math.min(diffBlockStarts.length - 1, currentBlockIndex + 1);
  revealBlock(currentBlockIndex);
});

recalcDiff();

// Worker確認手順:
// 1) pnpm install
// 2) pnpm run dev
// 3) ブラウザコンソールで "Could not create web worker(s)" が出ないことを確認
