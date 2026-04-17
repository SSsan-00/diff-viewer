import { describe, expect, it } from "vitest";
import type { PersistedState } from "./persistedState";
import {
  resolveStartupWorkspaceRestore,
  type StartupWorkspaceRestore,
} from "./startupRestore";
import type {
  Workspace,
  WorkspaceAnchorState,
  WorkspacesState,
} from "./workspaces";

const emptyAnchors: WorkspaceAnchorState = {
  manualAnchors: [],
  autoAnchor: null,
  suppressedAutoAnchorKey: null,
  pendingLeftLineNo: null,
  pendingRightLineNo: null,
  selectedAnchorKey: null,
};

function createWorkspace(
  id: string,
  overrides: Partial<Workspace> = {},
): Workspace {
  return {
    id,
    name: id,
    leftText: "",
    rightText: "",
    leftSegments: [],
    rightSegments: [],
    leftActiveFile: null,
    rightActiveFile: null,
    leftCursor: null,
    rightCursor: null,
    leftScrollTop: null,
    rightScrollTop: null,
    anchors: { ...emptyAnchors },
    ...overrides,
  };
}

function createPersistedState(
  overrides: Partial<PersistedState> = {},
): PersistedState {
  return {
    version: 1,
    leftText: "persisted left",
    rightText: "persisted right",
    leftEncoding: "utf-8",
    rightEncoding: "utf-8",
    scrollSync: true,
    foldEnabled: false,
    anchorPanelCollapsed: false,
    anchors: [{ leftLineNo: 0, rightLineNo: 0 }],
    leftSegments: [{ startLine: 1, lineCount: 1, fileIndex: 1, fileName: "left.txt" }],
    rightSegments: [{ startLine: 1, lineCount: 1, fileIndex: 1, fileName: "right.txt" }],
    ...overrides,
  };
}

function resolve(
  workspaceState: WorkspacesState,
  persistedState: PersistedState | null,
): StartupWorkspaceRestore {
  return resolveStartupWorkspaceRestore({
    workspaceState,
    persistedState,
    emptyAnchorState: emptyAnchors,
  });
}

describe("resolveStartupWorkspaceRestore", () => {
  it("restores the selected empty workspace from persisted state even when another workspace has text", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("other", {
          leftText: "other left",
          rightText: "other right",
        }),
        createWorkspace("current", {
          leftSegments: [{ startLine: 1, lineCount: 3, fileIndex: 1, fileName: "stale-left.txt" }],
          rightSegments: [{ startLine: 1, lineCount: 3, fileIndex: 1, fileName: "stale-right.txt" }],
        }),
      ],
    };

    const result = resolve(workspaceState, createPersistedState());

    expect(result.leftPane.text).toBe("persisted left");
    expect(result.rightPane.text).toBe("persisted right");
    expect(result.leftPane.segments).toEqual([
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "left.txt" },
    ]);
    expect(result.rightPane.segments).toEqual([
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "right.txt" },
    ]);
    expect(result.initialAnchors.manualAnchors).toEqual([{ leftLineNo: 0, rightLineNo: 0 }]);
    expect(result.shouldPersistLeftPane).toBe(true);
    expect(result.shouldPersistRightPane).toBe(true);
    expect(result.shouldPersistAnchors).toBe(true);
  });

  it("does not resurrect an intentionally cleared pane from persisted state while the workspace still has text", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("current", {
          leftText: "",
          rightText: "kept right",
        }),
      ],
    };

    const result = resolve(workspaceState, createPersistedState());

    expect(result.leftPane.text).toBe("");
    expect(result.rightPane.text).toBe("kept right");
    expect(result.shouldPersistLeftPane).toBe(false);
    expect(result.shouldPersistRightPane).toBe(false);
  });

  it("drops invalid stored anchors when the selected workspace has no restorable text", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("current", {
          anchors: {
            ...emptyAnchors,
            manualAnchors: [{ leftLineNo: 12, rightLineNo: 14 }],
            selectedAnchorKey: "manual:12:14",
          },
        }),
      ],
    };

    const result = resolve(
      workspaceState,
      createPersistedState({
        leftText: "",
        rightText: "",
        leftSegments: [],
        rightSegments: [],
        anchors: [],
      }),
    );

    expect(result.leftPane.text).toBe("");
    expect(result.rightPane.text).toBe("");
    expect(result.initialAnchors.manualAnchors).toEqual([]);
    expect(result.initialAnchors.selectedAnchorKey).toBeNull();
    expect(result.shouldPersistAnchors).toBe(true);
  });
});
