import { mapRowToLineNumbers } from "../diffEngine/diffBlocks";
import type { PairedOp } from "../diffEngine/types";
import type { ToastVariant } from "./toast";

type ToastLike = {
  show: (message: string, variant?: ToastVariant) => void;
};

type CopySide = "left" | "right";

export type CopyVisualRow = {
  leftText: string;
  rightText: string;
};

type CopyViewZoneSpec = {
  afterLineNumber: number;
  heightInLines?: number;
  label?: string;
};

type CopyFileZones = {
  left: CopyViewZoneSpec[];
  right: CopyViewZoneSpec[];
};

function opToCopyVisualRow(op: PairedOp): CopyVisualRow {
  if (op.type === "insert") {
    return { leftText: "", rightText: op.rightLine ?? "" };
  }
  if (op.type === "delete") {
    return { leftText: op.leftLine ?? "", rightText: "" };
  }
  return {
    leftText: op.leftLine ?? "",
    rightText: op.rightLine ?? "",
  };
}

function buildRowLineNumberPairs(
  ops: PairedOp[],
): Array<{ leftLineNo: number; rightLineNo: number }> {
  return ops.map((_op, rowIndex) => mapRowToLineNumbers(ops, rowIndex));
}

function findBoundaryRowIndex(
  rowLinePairs: Array<{ leftLineNo: number; rightLineNo: number }>,
  leftZone: CopyViewZoneSpec | undefined,
  rightZone: CopyViewZoneSpec | undefined,
  searchStart: number,
): number | null {
  for (let rowIndex = searchStart; rowIndex < rowLinePairs.length; rowIndex += 1) {
    const pair = rowLinePairs[rowIndex];
    const leftMatches = !leftZone || pair.leftLineNo === leftZone.afterLineNumber;
    const rightMatches = !rightZone || pair.rightLineNo === rightZone.afterLineNumber;
    if (leftMatches && rightMatches) {
      return rowIndex;
    }
  }
  return null;
}

function buildBoundaryRowsByIndex(
  ops: PairedOp[],
  fileZones: CopyFileZones,
): Map<number, CopyVisualRow[]> {
  const map = new Map<number, CopyVisualRow[]>();
  const pairCount = Math.max(fileZones.left.length, fileZones.right.length);
  if (pairCount === 0 || ops.length === 0) {
    return map;
  }

  const rowLinePairs = buildRowLineNumberPairs(ops);
  let searchStart = 0;

  for (let index = 0; index < pairCount; index += 1) {
    const leftZone = fileZones.left[index];
    const rightZone = fileZones.right[index];
    if (!leftZone && !rightZone) {
      continue;
    }

    const rowIndex = findBoundaryRowIndex(rowLinePairs, leftZone, rightZone, searchStart);
    if (rowIndex === null) {
      continue;
    }
    searchStart = rowIndex + 1;

    const heightInLines = Math.max(
      leftZone?.heightInLines ?? 0,
      rightZone?.heightInLines ?? 0,
      1,
    );
    const rows: CopyVisualRow[] = [];
    for (let line = 0; line < heightInLines; line += 1) {
      rows.push({
        leftText: line === 0 ? leftZone?.label ?? "" : "",
        rightText: line === 0 ? rightZone?.label ?? "" : "",
      });
    }

    const existing = map.get(rowIndex);
    if (existing) {
      existing.push(...rows);
    } else {
      map.set(rowIndex, rows);
    }
  }

  return map;
}

export function buildCopyVisualRowsFromAlignedDiff(
  ops: PairedOp[],
  fileZones?: CopyFileZones,
): CopyVisualRow[] {
  if (ops.length === 0) {
    return [];
  }

  const rows: CopyVisualRow[] = [];
  const boundaryRowsByIndex = fileZones ? buildBoundaryRowsByIndex(ops, fileZones) : new Map();

  for (let rowIndex = 0; rowIndex < ops.length; rowIndex += 1) {
    const boundaryRows = boundaryRowsByIndex.get(rowIndex);
    if (boundaryRows) {
      rows.push(...boundaryRows);
    }
    rows.push(opToCopyVisualRow(ops[rowIndex]));
  }

  return rows;
}

export function buildCopyTextFromVisualRows(
  rows: CopyVisualRow[],
  side: CopySide,
): string {
  if (rows.length === 0) {
    return "";
  }
  const values = rows.map((row) => (side === "left" ? row.leftText : row.rightText));
  return `${values.join("\n")}\n`;
}

export async function copyPaneSource(options: {
  side: CopySide;
  doc: Document;
  copy: (value: string, doc: Document) => Promise<boolean>;
  toast: ToastLike;
  getText: () => string;
}): Promise<boolean> {
  const { side, doc, copy, toast, getText } = options;
  const text = getText();
  if (!text) {
    toast.show("コピー対象がありません", "error");
    return false;
  }

  const ok = await copy(text, doc);
  if (ok) {
    toast.show(
      side === "left"
        ? "左ペインのソースをコピーしました。"
        : "右ペインのソースをコピーしました。",
    );
    return true;
  }

  toast.show("コピーに失敗しました", "error");
  return false;
}

export function bindPaneSourceCopyButton(options: {
  button: HTMLButtonElement | null;
  side: CopySide;
  doc: Document;
  copy: (value: string, doc: Document) => Promise<boolean>;
  toast: ToastLike;
  getText: () => string;
}): void {
  const { button, side, doc, copy, toast, getText } = options;
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    void copyPaneSource({ side, doc, copy, toast, getText });
  });
}
