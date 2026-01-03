// Line-level operation before pairing deletes/inserts into replaces.
export type LineOp = {
  type: "equal" | "insert" | "delete";
  leftLine?: string;
  rightLine?: string;
  leftLineNo?: number;
  rightLineNo?: number;
};

// Line-level operation after pairing, including "replace".
export type PairedOp = {
  type: "equal" | "insert" | "delete" | "replace";
  leftLine?: string;
  rightLine?: string;
  leftLineNo?: number;
  rightLineNo?: number;
};

// Half-open range: start is inclusive, end is exclusive.
export type Range = {
  start: number;
  end: number;
};

// Inline diff ranges for replace lines.
export type InlineDiff = {
  leftRanges: Range[];
  rightRanges: Range[];
};
