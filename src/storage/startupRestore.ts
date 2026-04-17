import { validateAnchors, type Anchor } from "../diffEngine/anchors";
import { normalizeText } from "../diffEngine/normalize";
import type { LineSegment } from "../file/lineNumbering";
import type { PersistedState } from "./persistedState";
import type {
  Workspace,
  WorkspaceAnchorState,
  WorkspacePaneState,
  WorkspacesState,
} from "./workspaces";

export type StartupWorkspaceRestore = {
  leftPane: WorkspacePaneState;
  rightPane: WorkspacePaneState;
  shouldPersistLeftPane: boolean;
  shouldPersistRightPane: boolean;
  initialAnchors: WorkspaceAnchorState;
  shouldPersistAnchors: boolean;
};

function cloneSegments(segments: LineSegment[] | undefined): LineSegment[] {
  return (segments ?? []).map((segment) => ({ ...segment }));
}

function cloneAnchor(anchor: Anchor): Anchor {
  return { leftLineNo: anchor.leftLineNo, rightLineNo: anchor.rightLineNo };
}

function cloneWorkspaceAnchors(state: WorkspaceAnchorState): WorkspaceAnchorState {
  return {
    manualAnchors: state.manualAnchors.map(cloneAnchor),
    autoAnchor: state.autoAnchor ? cloneAnchor(state.autoAnchor) : null,
    suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
    pendingLeftLineNo: state.pendingLeftLineNo,
    pendingRightLineNo: state.pendingRightLineNo,
    selectedAnchorKey: state.selectedAnchorKey,
  };
}

function getSelectedWorkspace(state: WorkspacesState): Workspace | null {
  return (
    state.workspaces.find((workspace) => workspace.id === state.selectedId) ??
    state.workspaces[0] ??
    null
  );
}

function getNormalizedLineCount(text: string): number {
  return normalizeText(text).split("\n").length;
}

export function isSegmentLayoutValid(segments: LineSegment[], text: string): boolean {
  if (segments.length === 0) {
    return true;
  }
  const lineCount = getNormalizedLineCount(text);
  let lastEnd = 0;
  for (const segment of segments) {
    if (
      segment.startLine < 1 ||
      segment.lineCount < 1 ||
      segment.fileIndex < 1
    ) {
      return false;
    }
    const end = segment.startLine + segment.lineCount - 1;
    if (end < segment.startLine || end < lastEnd) {
      return false;
    }
    lastEnd = Math.max(lastEnd, end);
  }
  return lastEnd <= lineCount;
}

function resolveWorkspacePane(
  workspace: Workspace | null,
  side: "left" | "right",
  persistedState: PersistedState | null,
  selectedWorkspaceLooksUnresolved: boolean,
): { pane: WorkspacePaneState; shouldPersist: boolean } {
  const textKey = side === "left" ? "leftText" : "rightText";
  const segmentsKey = side === "left" ? "leftSegments" : "rightSegments";
  const activeFileKey = side === "left" ? "leftActiveFile" : "rightActiveFile";
  const cursorKey = side === "left" ? "leftCursor" : "rightCursor";
  const scrollTopKey = side === "left" ? "leftScrollTop" : "rightScrollTop";
  const workspaceText = workspace?.[textKey] ?? "";
  const workspaceSegments = cloneSegments(workspace?.[segmentsKey]);
  const workspaceSegmentsValid = isSegmentLayoutValid(workspaceSegments, workspaceText);
  const persistedText = persistedState?.[textKey] ?? "";
  const persistedSegments = cloneSegments(persistedState?.[segmentsKey] ?? []);

  let text = workspaceText;
  let segments = workspaceSegmentsValid ? workspaceSegments : [];

  if (selectedWorkspaceLooksUnresolved && text.length === 0 && persistedText.length > 0) {
    text = persistedText;
  }

  if (
    segments.length === 0 &&
    selectedWorkspaceLooksUnresolved &&
    persistedSegments.length > 0 &&
    isSegmentLayoutValid(persistedSegments, text)
  ) {
    segments = persistedSegments;
  }

  const pane: WorkspacePaneState = {
    text,
    segments,
    activeFile: workspace?.[activeFileKey] ?? null,
    cursor: workspace?.[cursorKey] ?? null,
    scrollTop: workspace?.[scrollTopKey] ?? null,
  };
  const originalSegmentCount = (workspace?.[segmentsKey] ?? []).length;
  const shouldPersist =
    workspaceText !== pane.text ||
    !workspaceSegmentsValid ||
    (originalSegmentCount === 0 && pane.segments.length > 0);

  return { pane, shouldPersist };
}

function buildAnchorKey(prefix: "manual" | "auto", anchor: Anchor): string {
  return `${prefix}:${anchor.leftLineNo}:${anchor.rightLineNo}`;
}

function clampPendingLineNo(value: number | null, maxLines: number): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0 || value >= maxLines) {
    return null;
  }
  return value;
}

function sanitizeWorkspaceAnchors(
  state: WorkspaceAnchorState,
  leftText: string,
  rightText: string,
): WorkspaceAnchorState {
  const leftLineCount = getNormalizedLineCount(leftText);
  const rightLineCount = getNormalizedLineCount(rightText);
  const manualAnchors = validateAnchors(
    state.manualAnchors,
    leftLineCount,
    rightLineCount,
  ).valid.map(cloneAnchor);
  const autoAnchor = state.autoAnchor
    ? (validateAnchors(
        [state.autoAnchor],
        leftLineCount,
        rightLineCount,
      ).valid[0] ?? null)
    : null;
  const validSelectedKeys = new Set<string>(manualAnchors.map((anchor) => buildAnchorKey("manual", anchor)));
  if (autoAnchor) {
    validSelectedKeys.add(buildAnchorKey("auto", autoAnchor));
  }
  return {
    manualAnchors,
    autoAnchor,
    suppressedAutoAnchorKey:
      autoAnchor &&
      state.suppressedAutoAnchorKey === buildAnchorKey("auto", autoAnchor)
        ? state.suppressedAutoAnchorKey
        : null,
    pendingLeftLineNo: clampPendingLineNo(state.pendingLeftLineNo, leftLineCount),
    pendingRightLineNo: clampPendingLineNo(state.pendingRightLineNo, rightLineCount),
    selectedAnchorKey:
      state.selectedAnchorKey && validSelectedKeys.has(state.selectedAnchorKey)
        ? state.selectedAnchorKey
        : null,
  };
}

function anchorStatesEqual(
  left: WorkspaceAnchorState,
  right: WorkspaceAnchorState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function resolveStartupWorkspaceRestore(params: {
  workspaceState: WorkspacesState;
  persistedState: PersistedState | null;
  emptyAnchorState: WorkspaceAnchorState;
}): StartupWorkspaceRestore {
  const { workspaceState, persistedState, emptyAnchorState } = params;
  const selectedWorkspace = getSelectedWorkspace(workspaceState);
  const selectedWorkspaceLooksUnresolved =
    selectedWorkspace !== null &&
    selectedWorkspace.leftText.length === 0 &&
    selectedWorkspace.rightText.length === 0;
  const left = resolveWorkspacePane(
    selectedWorkspace,
    "left",
    persistedState,
    selectedWorkspaceLooksUnresolved,
  );
  const right = resolveWorkspacePane(
    selectedWorkspace,
    "right",
    persistedState,
    selectedWorkspaceLooksUnresolved,
  );

  const originalAnchors = cloneWorkspaceAnchors(
    selectedWorkspace?.anchors ?? emptyAnchorState,
  );
  let initialAnchors = sanitizeWorkspaceAnchors(
    originalAnchors,
    left.pane.text,
    right.pane.text,
  );

  if (
    selectedWorkspaceLooksUnresolved &&
    initialAnchors.manualAnchors.length === 0 &&
    initialAnchors.autoAnchor === null &&
    (persistedState?.anchors.length ?? 0) > 0
  ) {
    const migratedAnchors = validateAnchors(
      persistedState?.anchors ?? [],
      getNormalizedLineCount(left.pane.text),
      getNormalizedLineCount(right.pane.text),
    ).valid.map(cloneAnchor);
    if (migratedAnchors.length > 0) {
      initialAnchors = {
        ...cloneWorkspaceAnchors(emptyAnchorState),
        manualAnchors: migratedAnchors,
      };
    }
  }

  return {
    leftPane: left.pane,
    rightPane: right.pane,
    shouldPersistLeftPane: left.shouldPersist,
    shouldPersistRightPane: right.shouldPersist,
    initialAnchors,
    shouldPersistAnchors: !anchorStatesEqual(originalAnchors, initialAnchors),
  };
}
