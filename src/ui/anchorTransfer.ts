import type { Anchor } from "../diffEngine/anchors";
import {
  getLineSegmentInfo,
  type LineSegment,
} from "../file/lineNumbering";

export const ANCHOR_TRANSFER_KIND = "diff-viewer-anchors";
export const ANCHOR_TRANSFER_VERSION = 1;

export type AnchorTransferLine = {
  file: number;
  line: number;
};

export type AnchorTransferEntry = {
  left: AnchorTransferLine;
  right: AnchorTransferLine;
};

export type AnchorTransferPayload = {
  kind: typeof ANCHOR_TRANSFER_KIND;
  version: typeof ANCHOR_TRANSFER_VERSION;
  panes: {
    left: { files: number };
    right: { files: number };
  };
  anchors: AnchorTransferEntry[];
};

export type AnchorImportResult =
  | { ok: true; anchors: Anchor[]; swapped: boolean }
  | { ok: false; reason: "format" | "layout" | "range" };

type AnchorTransferBuildOptions = {
  leftSegments: readonly LineSegment[];
  rightSegments: readonly LineSegment[];
};

type AnchorTransferResolveOptions = AnchorTransferBuildOptions & {
  leftLineCount: number;
  rightLineCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

function getFileCount(segments: readonly LineSegment[]): number {
  if (segments.length === 0) {
    return 1;
  }
  return Math.max(
    1,
    ...segments.map((segment) =>
      Number.isFinite(segment.fileIndex) ? segment.fileIndex : 1,
    ),
  );
}

function toFileLine(
  lineNo: number,
  segments: readonly LineSegment[],
): AnchorTransferLine {
  const info = getLineSegmentInfo([...segments], lineNo + 1);
  if (!info) {
    return { file: 1, line: lineNo + 1 };
  }
  return { file: info.fileIndex, line: info.localLine };
}

function resolveFileLine(
  fileLine: AnchorTransferLine,
  segments: readonly LineSegment[],
  lineCount: number,
): number | null {
  if (fileLine.file < 1 || fileLine.line < 1) {
    return null;
  }
  if (segments.length === 0) {
    if (fileLine.file !== 1 || fileLine.line > lineCount) {
      return null;
    }
    return fileLine.line - 1;
  }
  const segment = segments.find((item) => item.fileIndex === fileLine.file);
  if (!segment || fileLine.line > segment.lineCount) {
    return null;
  }
  const oneBasedLineNo = segment.startLine + fileLine.line - 1;
  if (oneBasedLineNo < 1 || oneBasedLineNo > lineCount) {
    return null;
  }
  return oneBasedLineNo - 1;
}

function normalizeTransferLine(value: unknown): AnchorTransferLine | null {
  if (!isRecord(value)) {
    return null;
  }
  const file = toPositiveInteger(value.file);
  const line = toPositiveInteger(value.line);
  if (file === null || line === null) {
    return null;
  }
  return { file, line };
}

function normalizeTransferEntry(value: unknown): AnchorTransferEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const left = normalizeTransferLine(value.left);
  const right = normalizeTransferLine(value.right);
  if (!left || !right) {
    return null;
  }
  return { left, right };
}

export function parseAnchorTransferPayload(value: unknown): AnchorTransferPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.kind !== ANCHOR_TRANSFER_KIND ||
    value.version !== ANCHOR_TRANSFER_VERSION ||
    !isRecord(value.panes) ||
    !isRecord(value.panes.left) ||
    !isRecord(value.panes.right) ||
    !Array.isArray(value.anchors)
  ) {
    return null;
  }
  const leftFiles = toPositiveInteger(value.panes.left.files);
  const rightFiles = toPositiveInteger(value.panes.right.files);
  if (leftFiles === null || rightFiles === null) {
    return null;
  }
  const anchors: AnchorTransferEntry[] = [];
  for (const entry of value.anchors) {
    const anchor = normalizeTransferEntry(entry);
    if (!anchor) {
      return null;
    }
    anchors.push(anchor);
  }
  return {
    kind: ANCHOR_TRANSFER_KIND,
    version: ANCHOR_TRANSFER_VERSION,
    panes: {
      left: { files: leftFiles },
      right: { files: rightFiles },
    },
    anchors,
  };
}

export function buildAnchorTransferPayload(
  anchors: readonly Anchor[],
  options: AnchorTransferBuildOptions,
): AnchorTransferPayload {
  return {
    kind: ANCHOR_TRANSFER_KIND,
    version: ANCHOR_TRANSFER_VERSION,
    panes: {
      left: { files: getFileCount(options.leftSegments) },
      right: { files: getFileCount(options.rightSegments) },
    },
    anchors: anchors.map((anchor) => ({
      left: toFileLine(anchor.leftLineNo, options.leftSegments),
      right: toFileLine(anchor.rightLineNo, options.rightSegments),
    })),
  };
}

export function resolveImportedAnchors(
  rawPayload: unknown,
  options: AnchorTransferResolveOptions,
): AnchorImportResult {
  const payload = parseAnchorTransferPayload(rawPayload);
  if (!payload) {
    return { ok: false, reason: "format" };
  }

  const currentLeftFiles = getFileCount(options.leftSegments);
  const currentRightFiles = getFileCount(options.rightSegments);
  const normalMatches =
    currentLeftFiles === payload.panes.left.files &&
    currentRightFiles === payload.panes.right.files;
  const swappedMatches =
    currentLeftFiles === payload.panes.right.files &&
    currentRightFiles === payload.panes.left.files;

  if (!normalMatches && !swappedMatches) {
    return { ok: false, reason: "layout" };
  }

  const swapped = !normalMatches && swappedMatches;
  const anchors: Anchor[] = [];
  for (const entry of payload.anchors) {
    const left = swapped ? entry.right : entry.left;
    const right = swapped ? entry.left : entry.right;
    const leftLineNo = resolveFileLine(
      left,
      options.leftSegments,
      options.leftLineCount,
    );
    const rightLineNo = resolveFileLine(
      right,
      options.rightSegments,
      options.rightLineCount,
    );
    if (leftLineNo === null || rightLineNo === null) {
      return { ok: false, reason: "range" };
    }
    anchors.push({ leftLineNo, rightLineNo });
  }

  return { ok: true, anchors, swapped };
}
