import type {
  Workspace,
  WorkspaceAnchorState,
  WorkspaceCursor,
  WorkspaceDraft,
  StaleManualAnchor,
} from "../storage/workspaces";
import { normalizeStaleAnchorTracking } from "../storage/workspaces";
import type { LineSegment } from "../file/lineNumbering";

export const WORKSPACE_TRANSFER_KIND = "diff-viewer-workspace";
export const WORKSPACE_TRANSFER_VERSION = 1;

export type WorkspaceTransferPayload = {
  kind: typeof WORKSPACE_TRANSFER_KIND;
  version: typeof WORKSPACE_TRANSFER_VERSION;
  workspace: WorkspaceDraft;
};

export type WorkspaceTransferParseResult =
  | { ok: true; workspace: WorkspaceDraft }
  | { ok: false; reason: "format" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneSegments(segments: readonly LineSegment[] | undefined): LineSegment[] {
  return (segments ?? []).map((segment) => ({ ...segment }));
}

function cloneCursor(cursor: WorkspaceCursor | null | undefined): WorkspaceCursor | null {
  return cursor ? { ...cursor } : null;
}

function cloneAnchors(anchors: WorkspaceAnchorState): WorkspaceAnchorState {
  return {
    manualAnchors: anchors.manualAnchors.map((anchor) => ({ ...anchor })),
    staleManualAnchors: (anchors.staleManualAnchors ?? []).map((item) => ({
      anchor: { ...item.anchor },
      ...(item.tracking
        ? {
            tracking: {
              leftLineNo: item.tracking.leftLineNo,
              rightLineNo: item.tracking.rightLineNo,
            },
          }
        : {}),
      reason: item.reason,
    })),
    autoAnchor: anchors.autoAnchor ? { ...anchors.autoAnchor } : null,
    suppressedAutoAnchorKey: anchors.suppressedAutoAnchorKey,
    pendingLeftLineNo: anchors.pendingLeftLineNo,
    pendingRightLineNo: anchors.pendingRightLineNo,
    selectedAnchorKey: anchors.selectedAnchorKey,
  };
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAnchor(value: unknown): { leftLineNo: number; rightLineNo: number } | null {
  if (!isRecord(value)) {
    return null;
  }
  const leftLineNo = normalizeNumberOrNull(value.leftLineNo);
  const rightLineNo = normalizeNumberOrNull(value.rightLineNo);
  if (leftLineNo === null || rightLineNo === null) {
    return null;
  }
  return { leftLineNo, rightLineNo };
}

function normalizeAnchorList(value: unknown): { leftLineNo: number; rightLineNo: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const anchors: { leftLineNo: number; rightLineNo: number }[] = [];
  value.forEach((entry) => {
    const anchor = normalizeAnchor(entry);
    if (anchor) {
      anchors.push(anchor);
    }
  });
  return anchors;
}

function normalizeStaleAnchorList(value: unknown): StaleManualAnchor[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const anchors: StaleManualAnchor[] = [];
  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const anchor = normalizeAnchor(entry.anchor);
    const tracking = normalizeStaleAnchorTracking(entry.tracking);
    if (
      anchor &&
      (entry.reason === "edit-unresolved" || entry.reason === "reload-unresolved")
    ) {
      anchors.push({
        anchor,
        ...(tracking ? { tracking } : {}),
        reason: entry.reason,
      });
    }
  });
  return anchors;
}

function normalizeAnchorState(value: unknown): WorkspaceAnchorState {
  const record = isRecord(value) ? value : {};
  return {
    manualAnchors: normalizeAnchorList(record.manualAnchors),
    staleManualAnchors: normalizeStaleAnchorList(record.staleManualAnchors),
    autoAnchor: normalizeAnchor(record.autoAnchor),
    suppressedAutoAnchorKey: normalizeNullableString(record.suppressedAutoAnchorKey),
    pendingLeftLineNo: normalizeNumberOrNull(record.pendingLeftLineNo),
    pendingRightLineNo: normalizeNumberOrNull(record.pendingRightLineNo),
    selectedAnchorKey: normalizeNullableString(record.selectedAnchorKey),
  };
}

function normalizeCursor(value: unknown): WorkspaceCursor | null {
  if (!isRecord(value)) {
    return null;
  }
  const lineNumber = normalizeNumberOrNull(value.lineNumber);
  const column = normalizeNumberOrNull(value.column);
  if (lineNumber === null || column === null) {
    return null;
  }
  return { lineNumber, column };
}

function normalizeSegments(value: unknown): LineSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const segments: LineSegment[] = [];
  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const startLine = normalizeNumberOrNull(entry.startLine);
    const lineCount = normalizeNumberOrNull(entry.lineCount);
    const fileIndex = normalizeNumberOrNull(entry.fileIndex);
    if (startLine === null || lineCount === null || fileIndex === null) {
      return;
    }
    segments.push({
      startLine,
      lineCount,
      fileIndex,
      fileName: normalizeNullableString(entry.fileName) ?? undefined,
      endsWithNewline:
        typeof entry.endsWithNewline === "boolean"
          ? entry.endsWithNewline
          : undefined,
    });
  });
  return segments;
}

function buildWorkspaceDraft(workspace: Workspace): WorkspaceDraft {
  return {
    name: workspace.name,
    leftText: workspace.leftText,
    rightText: workspace.rightText,
    leftSegments: cloneSegments(workspace.leftSegments),
    rightSegments: cloneSegments(workspace.rightSegments),
    leftActiveFile: workspace.leftActiveFile ?? null,
    rightActiveFile: workspace.rightActiveFile ?? null,
    leftCursor: cloneCursor(workspace.leftCursor),
    rightCursor: cloneCursor(workspace.rightCursor),
    leftScrollTop: workspace.leftScrollTop ?? null,
    rightScrollTop: workspace.rightScrollTop ?? null,
    anchors: cloneAnchors(workspace.anchors),
  };
}

export function buildWorkspaceTransferPayload(
  workspace: Workspace,
): WorkspaceTransferPayload {
  return {
    kind: WORKSPACE_TRANSFER_KIND,
    version: WORKSPACE_TRANSFER_VERSION,
    workspace: buildWorkspaceDraft(workspace),
  };
}

export function parseWorkspaceTransferPayload(
  value: unknown,
): WorkspaceTransferParseResult {
  if (
    !isRecord(value) ||
    value.kind !== WORKSPACE_TRANSFER_KIND ||
    value.version !== WORKSPACE_TRANSFER_VERSION ||
    !isRecord(value.workspace)
  ) {
    return { ok: false, reason: "format" };
  }
  const workspace = value.workspace;
  return {
    ok: true,
    workspace: {
      name: normalizeString(workspace.name) || "Workspace",
      leftText: normalizeString(workspace.leftText),
      rightText: normalizeString(workspace.rightText),
      leftSegments: normalizeSegments(workspace.leftSegments),
      rightSegments: normalizeSegments(workspace.rightSegments),
      leftActiveFile: normalizeNullableString(workspace.leftActiveFile),
      rightActiveFile: normalizeNullableString(workspace.rightActiveFile),
      leftCursor: normalizeCursor(workspace.leftCursor),
      rightCursor: normalizeCursor(workspace.rightCursor),
      leftScrollTop: normalizeNumberOrNull(workspace.leftScrollTop),
      rightScrollTop: normalizeNumberOrNull(workspace.rightScrollTop),
      anchors: normalizeAnchorState(workspace.anchors),
    },
  };
}
