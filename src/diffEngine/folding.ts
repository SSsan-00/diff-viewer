import type { PairedOp } from "./types";

export type FoldRange = {
  startRow: number;
  endRow: number;
  hiddenStartRow: number;
  hiddenEndRow: number;
  hiddenCount: number;
  totalCount: number;
};

export type FoldOptions = {
  threshold: number;
  keepHead: number;
  keepTail: number;
};

function buildEqualBlocks(ops: PairedOp[]): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  let inBlock = false;
  let blockStart = 0;

  for (let i = 0; i < ops.length; i += 1) {
    const isEqual = ops[i].type === "equal";
    if (isEqual && !inBlock) {
      inBlock = true;
      blockStart = i;
    }
    if (!isEqual && inBlock) {
      blocks.push({ start: blockStart, end: i - 1 });
      inBlock = false;
    }
  }

  if (inBlock) {
    blocks.push({ start: blockStart, end: ops.length - 1 });
  }

  return blocks;
}

export function buildFoldRanges(ops: PairedOp[], options: FoldOptions): FoldRange[] {
  const folds: FoldRange[] = [];
  const { threshold, keepHead, keepTail } = options;

  for (const block of buildEqualBlocks(ops)) {
    const totalCount = block.end - block.start + 1;
    if (totalCount < threshold) {
      continue;
    }

    const hiddenStartRow = block.start + keepHead;
    const hiddenEndRow = block.end - keepTail;
    const hiddenCount = hiddenEndRow - hiddenStartRow + 1;

    if (hiddenCount <= 1) {
      continue;
    }

    folds.push({
      startRow: block.start,
      endRow: block.end,
      hiddenStartRow,
      hiddenEndRow,
      hiddenCount,
      totalCount,
    });
  }

  return folds;
}

export function findFoldContainingRow(
  folds: FoldRange[],
  rowIndex: number,
): FoldRange | undefined {
  return folds.find(
    (fold) => rowIndex >= fold.hiddenStartRow && rowIndex <= fold.hiddenEndRow,
  );
}
