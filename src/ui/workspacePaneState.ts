import type { LineSegment } from "../file/lineNumbering";
import type { WorkspacePaneState } from "../storage/workspaces";

export type PaneSnapshotAdapter = {
  getValue: () => string;
  setValue: (value: string) => void;
  getPosition?: () => { lineNumber: number; column: number } | null;
  setPosition?: (position: { lineNumber: number; column: number }) => void;
  getScrollTop?: () => number;
  setScrollTop?: (value: number) => void;
  getLineCount?: () => number;
};

export function cloneSegments(segments: LineSegment[]): LineSegment[] {
  return segments.map((segment) => ({ ...segment }));
}

export function collectPaneSnapshot(
  adapter: PaneSnapshotAdapter,
  segments: LineSegment[],
  activeFile: string | null,
): WorkspacePaneState {
  const position = adapter.getPosition?.() ?? null;
  const scrollTop = adapter.getScrollTop?.() ?? null;
  return {
    text: adapter.getValue(),
    segments: cloneSegments(segments),
    activeFile,
    cursor: position
      ? { lineNumber: position.lineNumber, column: position.column }
      : null,
    scrollTop,
  };
}

export function applyPaneSnapshot(
  adapter: PaneSnapshotAdapter,
  segments: LineSegment[],
  snapshot: WorkspacePaneState,
  options?: { applyText?: boolean },
): void {
  const applyText = options?.applyText ?? true;
  if (applyText) {
    adapter.setValue(snapshot.text);
  }
  segments.length = 0;
  segments.push(...cloneSegments(snapshot.segments));
  if (snapshot.cursor && adapter.setPosition) {
    const maxLine = adapter.getLineCount?.() ?? snapshot.cursor.lineNumber;
    const lineNumber = Math.min(
      Math.max(snapshot.cursor.lineNumber, 1),
      Math.max(maxLine, 1),
    );
    const column = Math.max(snapshot.cursor.column, 1);
    adapter.setPosition({ lineNumber, column });
  }
  if (snapshot.scrollTop !== null && adapter.setScrollTop) {
    adapter.setScrollTop(snapshot.scrollTop);
  }
}
