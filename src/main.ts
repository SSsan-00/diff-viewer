import "./style.css";
import "monaco-editor/min/vs/editor/editor.main.css";
import * as monaco from "monaco-editor";
import { setupMonacoWorkers } from "./monaco/monacoWorkers";
import { diffLines } from "./diffEngine/diffLines";
import { pairReplace } from "./diffEngine/pairReplace";
import { diffInline } from "./diffEngine/diffInline";
import type { PairedOp } from "./diffEngine/types";
import { ScrollSyncController } from "./scrollSync/ScrollSyncController";
import { getDiffBlockStarts, mapRowToLineNumbers } from "./diffEngine/diffBlocks";
import { decodeArrayBuffer, type FileEncoding } from "./file/decode";
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

// Run once before creating any editor instances.
setupMonacoWorkers();

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container is missing.");
}

app.innerHTML = `
  <div class="app">
    <header class="toolbar">
      <div class="toolbar-left">
        <div class="title">Diff Viewer</div>
      </div>
      <div class="toolbar-right">
        <button id="recalc" class="button" type="button">差分再計算</button>
        <button id="diff-prev" class="button" type="button">前の差分</button>
        <button id="diff-next" class="button" type="button">次の差分</button>
        <label class="toggle">
          <input id="sync-toggle" type="checkbox" checked />
          <span>スクロール連動</span>
        </label>
        <label class="toggle">
          <input id="fold-toggle" type="checkbox" />
          <span>差分なしの箇所を折りたたみ</span>
        </label>
        <button id="clear" class="button button-subtle" type="button">クリア</button>
      </div>
    </header>
    <section class="anchor-panel">
      <div class="anchor-header">
        <div class="anchor-title">アンカー</div>
        <div id="anchor-message" class="anchor-message" aria-live="polite"></div>
      </div>
      <div id="anchor-warning" class="anchor-warning" aria-live="polite"></div>
      <ul id="anchor-list" class="anchor-list"></ul>
    </section>
    <div class="editors">
      <section class="editor-pane">
        <div class="pane-title">
          <span>Left</span>
          <label class="pane-select">
            文字コード
            <select id="left-encoding">
              <option value="utf-8" selected>UTF-8</option>
              <option value="shift_jis">Shift_JIS</option>
              <option value="euc-jp">EUC-JP</option>
              <option value="auto">自動（BOM/UTF-8判定）</option>
            </select>
          </label>
        </div>
        <div id="left-drop" class="drop-zone">ここにファイルをドロップ</div>
        <div class="file-picker">
          <input id="left-file" class="file-input" type="file" />
          <button id="left-file-button" class="button button-subtle" type="button">
            ファイルを選択
          </button>
          <span class="file-hint">またはドラッグ&ドロップ</span>
        </div>
        <div id="left-message" class="pane-message" aria-live="polite"></div>
        <div id="left-editor" class="editor"></div>
      </section>
      <section class="editor-pane">
        <div class="pane-title">
          <span>Right</span>
          <label class="pane-select">
            文字コード
            <select id="right-encoding">
              <option value="utf-8" selected>UTF-8</option>
              <option value="shift_jis">Shift_JIS</option>
              <option value="euc-jp">EUC-JP</option>
              <option value="auto">自動（BOM/UTF-8判定）</option>
            </select>
          </label>
        </div>
        <div id="right-drop" class="drop-zone">ここにファイルをドロップ</div>
        <div class="file-picker">
          <input id="right-file" class="file-input" type="file" />
          <button id="right-file-button" class="button button-subtle" type="button">
            ファイルを選択
          </button>
          <span class="file-hint">またはドラッグ&ドロップ</span>
        </div>
        <div id="right-message" class="pane-message" aria-live="polite"></div>
        <div id="right-editor" class="editor"></div>
      </section>
    </div>
  </div>
`;

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const leftContainer = getRequiredElement<HTMLDivElement>("#left-editor");
const rightContainer = getRequiredElement<HTMLDivElement>("#right-editor");
const leftDropZone = getRequiredElement<HTMLDivElement>("#left-drop");
const rightDropZone = getRequiredElement<HTMLDivElement>("#right-drop");
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
});

const rightEditor = monaco.editor.create(rightContainer, {
  value: rightInitial,
  language: "plaintext",
  theme: "vs",
  automaticLayout: true,
  glyphMargin: true,
  minimap: { enabled: false },
});

function setPaneMessage(target: HTMLDivElement, message: string, isError: boolean) {
  target.textContent = message;
  target.classList.toggle("is-error", isError);
}

async function handleFileDrop(
  file: File,
  encoding: FileEncoding,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
) {
  try {
    const buffer = await file.arrayBuffer();
    const text = decodeArrayBuffer(buffer, encoding);
    editor.setValue(text);
    setPaneMessage(messageTarget, `読み込み完了: ${file.name}`, false);
    recalcDiff();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "読み込みに失敗しました";
    console.error(error);
    setPaneMessage(messageTarget, message, true);
  }
}

function bindDropZone(
  zone: HTMLDivElement,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  encodingSelect: HTMLSelectElement,
) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.add("is-dragover");
  });

  zone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("is-dragover");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("is-dragover");

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      setPaneMessage(messageTarget, "ファイルが見つかりませんでした", true);
      return;
    }

    const encoding = encodingSelect.value as FileEncoding;
    void handleFileDrop(file, encoding, editor, messageTarget);
  });
}

bindDropZone(leftDropZone, leftEditor, leftMessage, leftEncodingSelect);
bindDropZone(rightDropZone, rightEditor, rightMessage, rightEncodingSelect);

function bindFilePicker(
  input: HTMLInputElement,
  button: HTMLButtonElement,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  encodingSelect: HTMLSelectElement,
) {
  button.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const encoding = encodingSelect.value as FileEncoding;
    void handleFileDrop(file, encoding, editor, messageTarget);
    input.value = "";
  });
}

bindFilePicker(leftFileInput, leftFileButton, leftEditor, leftMessage, leftEncodingSelect);
bindFilePicker(rightFileInput, rightFileButton, rightEditor, rightMessage, rightEncodingSelect);

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
  const removal = removeAnchorByLeft(anchors, leftLineNo);
  if (removal.removed) {
    anchors = removal.next;
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor removed: ${formatAnchor(removal.removed)}`);
  } else if (pendingRightLineNo !== null) {
    const anchor = { leftLineNo, rightLineNo: pendingRightLineNo };
    anchors = addAnchor(anchors, anchor);
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
    anchors,
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
  const removal = removeAnchorByRight(anchors, rightLineNo);
  if (removal.removed) {
    anchors = removal.next;
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor removed: ${formatAnchor(removal.removed)}`);
  } else if (pendingLeftLineNo === null) {
    pendingRightLineNo = rightLineNo;
    setAnchorMessage("右行を選択しました。左行を選んでください。");
  } else {
    const leftLineNo = pendingLeftLineNo;
    const anchor = { leftLineNo, rightLineNo };
    anchors = addAnchor(anchors, anchor);
    pendingLeftLineNo = null;
    pendingRightLineNo = null;
    setAnchorMessage(`Anchor added: ${formatAnchor(anchor)}`);
    recalcDiff();
  }
  updatePendingAnchorDecoration();
  const validation = validateAnchors(
    anchors,
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
let foldEnabled = false;
let foldRanges: FoldRange[] = [];
let leftFoldZoneIds: string[] = [];
let rightFoldZoneIds: string[] = [];
const expandedFoldStarts = new Set<number>();
let anchors: Anchor[] = [];
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

function formatAnchor(anchor: Anchor): string {
  return `L${anchor.leftLineNo + 1} ↔ R${anchor.rightLineNo + 1}`;
}

function anchorKey(anchor: Anchor): string {
  return `${anchor.leftLineNo}:${anchor.rightLineNo}`;
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
      const left = item.anchor.leftLineNo + 1;
      const right = item.anchor.rightLineNo + 1;
      return `L${left} ↔ R${right}: ${item.reasons.join(" / ")}`;
    })
    .join(" | ");
  anchorWarning.textContent = `無効なアンカーがあります: ${message}`;
}

function renderAnchors(
  invalid: { anchor: Anchor; reasons: string[] }[],
  valid: Anchor[],
) {
  anchorList.innerHTML = "";
  if (anchors.length === 0) {
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

  anchors.forEach((anchor, index) => {
    const item = document.createElement("li");
    item.className = "anchor-item";
    if (selectedAnchorKey === anchorKey(anchor)) {
      item.classList.add("is-selected");
    }
    const left = anchor.leftLineNo + 1;
    const right = anchor.rightLineNo + 1;
    const reason = invalidMap.get(anchor);

    const label = document.createElement("span");
    label.textContent = `L${left} ↔ R${right}`;
    label.className = "anchor-link";
    if (reason) {
      label.classList.add("anchor-invalid");
      label.textContent += `（無効: ${reason}）`;
    } else if (!validSet.has(anchor)) {
      label.classList.add("anchor-disabled");
    }

    if (validSet.has(anchor)) {
      label.addEventListener("click", () => {
        selectedAnchorKey = anchorKey(anchor);
        renderAnchors(invalid, valid);
        leftEditor.revealLineInCenter(anchor.leftLineNo + 1);
        rightEditor.revealLineInCenter(anchor.rightLineNo + 1);
        setAnchorMessage(`Anchor jump: ${formatAnchor(anchor)}`);
      });
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "anchor-remove";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", () => {
      removeButton.blur();
      const removed = anchors[index];
      anchors = anchors.filter((_, anchorIndex) => anchorIndex !== index);
      if (selectedAnchorKey === anchorKey(removed)) {
        selectedAnchorKey = null;
      }
      setAnchorMessage(`Anchor removed: ${formatAnchor(removed)}`);
      recalcDiff();
      const validation = validateAnchors(
        anchors,
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

function buildAnchorDecorations(validAnchors: Anchor[]): {
  left: monaco.editor.IModelDeltaDecoration[];
  right: monaco.editor.IModelDeltaDecoration[];
} {
  const left: monaco.editor.IModelDeltaDecoration[] = [];
  const right: monaco.editor.IModelDeltaDecoration[] = [];

  validAnchors.forEach((anchor) => {
    const leftRange = new monaco.Range(anchor.leftLineNo + 1, 1, anchor.leftLineNo + 1, 1);
    left.push({
      range: leftRange,
      options: {
        isWholeLine: true,
        className: "diff-anchor-line",
        glyphMarginClassName: "diff-anchor-glyph",
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
        className: "diff-anchor-line",
        glyphMarginClassName: "diff-anchor-glyph",
      },
    });
  });

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

function applyViewZones(
  editor: monaco.editor.IStandaloneCodeEditor,
  currentZoneIds: string[],
  zones: ViewZoneSpec[],
): string[] {
  const nextZoneIds: string[] = [];

  editor.changeViewZones((accessor) => {
    for (const zoneId of currentZoneIds) {
      accessor.removeZone(zoneId);
    }

    for (const zone of zones) {
      const domNode = document.createElement("div");
      domNode.className = zone.className;
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

  editor.changeViewZones((accessor) => {
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
    anchors,
    getNormalizedLineCount(leftText),
    getNormalizedLineCount(rightText),
  );

  if (validation.invalid.length > 0) {
    console.warn("無効なアンカーが検出されました:", validation.invalid);
  }

  updateAnchorWarning(validation.invalid);
  renderAnchors(validation.invalid, validation.valid);

  if (validation.valid.length > 0) {
    pairedOps = diffWithAnchors(leftText, rightText, validation.valid);
  } else {
    pairedOps = pairReplace(diffLines(leftText, rightText));
  }

  diffBlockStarts = getDiffBlockStarts(pairedOps);
  currentBlockIndex = 0;
  foldRanges = buildFoldRanges(pairedOps, foldOptions);
  expandedFoldStarts.clear();
  const { left, right } = buildDecorations(pairedOps);
  const anchorDecorations = buildAnchorDecorations(validation.valid);
  const zones = buildViewZones(pairedOps);

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
  leftZoneIds = applyViewZones(leftEditor, leftZoneIds, zones.left);
  rightZoneIds = applyViewZones(rightEditor, rightZoneIds, zones.right);
  updateDiffJumpButtons();
  applyFolding();
}

const recalcButton = document.querySelector<HTMLButtonElement>("#recalc");
recalcButton?.addEventListener("click", () => {
  recalcDiff();
});

clearButton.addEventListener("click", () => {
  const confirmed = window.confirm("左右の内容とアンカーを全てクリアします。よろしいですか？");
  if (!confirmed) {
    return;
  }
  anchors = [];
  pendingLeftLineNo = null;
  pendingRightLineNo = null;
  selectedAnchorKey = null;
  leftEditor.setValue("");
  rightEditor.setValue("");
  recalcDiff();
  setAnchorMessage("アンカーを全てクリアしました。");
});

const syncToggle = document.querySelector<HTMLInputElement>("#sync-toggle");
syncToggle?.addEventListener("change", (event) => {
  scrollSync.setEnabled((event.target as HTMLInputElement).checked);
});

const foldToggle = document.querySelector<HTMLInputElement>("#fold-toggle");
foldToggle?.addEventListener("change", (event) => {
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
