import type { PairedOp } from "./types";

export function getDiffBlockStarts(ops: PairedOp[]): number[] {
  const starts: number[] = [];
  let inBlock = false;

  for (let i = 0; i < ops.length; i += 1) {
    if (ops[i].type !== "equal") {
      if (!inBlock) {
        starts.push(i);
        inBlock = true;
      }
    } else {
      inBlock = false;
    }
  }

  return starts;
}

export function mapRowToLineNumbers(
  ops: PairedOp[],
  rowIndex: number,
): { leftLineNo: number; rightLineNo: number } {
  if (ops.length === 0) {
    return { leftLineNo: 0, rightLineNo: 0 };
  }

  const safeIndex = Math.min(Math.max(rowIndex, 0), ops.length - 1);
  let consumedLeftLines = 0;
  let consumedRightLines = 0;

  for (let i = 0; i < safeIndex; i += 1) {
    const op = ops[i];
    if (op.type === "equal" || op.type === "replace") {
      consumedLeftLines += 1;
      consumedRightLines += 1;
    } else if (op.type === "insert") {
      consumedRightLines += 1;
    } else if (op.type === "delete") {
      consumedLeftLines += 1;
    }
  }

  return {
    leftLineNo: consumedLeftLines,
    rightLineNo: consumedRightLines,
  };
}
