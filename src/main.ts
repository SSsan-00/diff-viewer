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
      </div>
    </header>
    <div class="editors">
      <section class="editor-pane">
        <div class="pane-title">Left</div>
        <div id="left-editor" class="editor"></div>
      </section>
      <section class="editor-pane">
        <div class="pane-title">Right</div>
        <div id="right-editor" class="editor"></div>
      </section>
    </div>
  </div>
`;

const leftContainer = document.querySelector<HTMLDivElement>("#left-editor");
const rightContainer = document.querySelector<HTMLDivElement>("#right-editor");

if (!leftContainer || !rightContainer) {
  throw new Error("Editor containers are missing.");
}

const leftInitial = `a
x
b
c`;

const rightInitial = `a
b
y
c`;

const leftEditor = monaco.editor.create(leftContainer, {
  value: leftInitial,
  language: "plaintext",
  theme: "vs",
  automaticLayout: true,
  minimap: { enabled: false },
});

const rightEditor = monaco.editor.create(rightContainer, {
  value: rightInitial,
  language: "plaintext",
  theme: "vs",
  automaticLayout: true,
  minimap: { enabled: false },
});

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

let leftDecorationIds: string[] = [];
let rightDecorationIds: string[] = [];
let leftZoneIds: string[] = [];
let rightZoneIds: string[] = [];
let pairedOps: PairedOp[] = [];
let diffBlockStarts: number[] = [];
let currentBlockIndex = 0;

type ZoneSide = "insert" | "delete";

type ViewZoneSpec = {
  afterLineNumber: number;
  heightInLines: number;
  className: string;
};

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

function recalcDiff() {
  const leftText = leftEditor.getValue();
  const rightText = rightEditor.getValue();
  pairedOps = pairReplace(diffLines(leftText, rightText));
  diffBlockStarts = getDiffBlockStarts(pairedOps);
  currentBlockIndex = 0;
  const { left, right } = buildDecorations(pairedOps);
  const zones = buildViewZones(pairedOps);

  leftDecorationIds = leftEditor.deltaDecorations(leftDecorationIds, left);
  rightDecorationIds = rightEditor.deltaDecorations(rightDecorationIds, right);
  leftZoneIds = applyViewZones(leftEditor, leftZoneIds, zones.left);
  rightZoneIds = applyViewZones(rightEditor, rightZoneIds, zones.right);
  updateDiffJumpButtons();
}

const recalcButton = document.querySelector<HTMLButtonElement>("#recalc");
recalcButton?.addEventListener("click", () => {
  recalcDiff();
});

const syncToggle = document.querySelector<HTMLInputElement>("#sync-toggle");
syncToggle?.addEventListener("change", (event) => {
  scrollSync.setEnabled((event.target as HTMLInputElement).checked);
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

function revealBlock(index: number) {
  if (diffBlockStarts.length === 0) {
    return;
  }
  const rowIndex = diffBlockStarts[index];
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
// 1) npm install
// 2) npm run dev
// 3) ブラウザコンソールで "Could not create web worker(s)" が出ないことを確認
