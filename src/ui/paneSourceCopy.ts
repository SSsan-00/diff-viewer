import type { PairedOp } from "../diffEngine/types";
import type { ToastVariant } from "./toast";

type ToastLike = {
  show: (message: string, variant?: ToastVariant) => void;
};

type CopySide = "left" | "right";

export type CopyVisualRow = {
  diffVisible?: boolean;
  kind?: PairedOp["type"];
  leftText: string;
  leftVirtual?: boolean;
  rightText: string;
  rightVirtual?: boolean;
};

type CopyViewZoneSpec = {
  afterLineNumber: number;
  className?: string;
  heightInLines?: number;
  label?: string;
};

type CopyFileZones = {
  left: CopyViewZoneSpec[];
  right: CopyViewZoneSpec[];
};

function opToCopyVisualRow(op: PairedOp): CopyVisualRow {
  const metadata = {
    ...(op.diffVisible === undefined ? {} : { diffVisible: op.diffVisible }),
    kind: op.type,
  };
  if (op.type === "insert") {
    return {
      ...metadata,
      leftText: "",
      leftVirtual: true,
      rightText: op.rightLine ?? "",
    };
  }
  if (op.type === "delete") {
    return {
      ...metadata,
      leftText: op.leftLine ?? "",
      rightText: "",
      rightVirtual: true,
    };
  }
  return {
    ...metadata,
    leftText: op.leftLine ?? "",
    rightText: op.rightLine ?? "",
  };
}

function buildRowLineNumberPairs(
  ops: PairedOp[],
): Array<{ leftLineNo: number; rightLineNo: number }> {
  const pairs: Array<{ leftLineNo: number; rightLineNo: number }> = [];
  let leftLineNo = 0;
  let rightLineNo = 0;
  for (const op of ops) {
    pairs.push({ leftLineNo, rightLineNo });
    if (op.type === "equal" || op.type === "replace") {
      leftLineNo += 1;
      rightLineNo += 1;
    } else if (op.type === "insert") {
      rightLineNo += 1;
    } else {
      leftLineNo += 1;
    }
  }
  return pairs;
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
        diffVisible: false,
        kind: "equal",
        leftText: line === 0 ? leftZone?.label ?? "" : "",
        leftVirtual: true,
        rightText: line === 0 ? rightZone?.label ?? "" : "",
        rightVirtual: true,
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
