import { describe, expect, it } from "vitest";
import type { PersistedState } from "./persistedState";
import {
  isSegmentLayoutValid,
  resolveStartupWorkspaceRestore,
  type StartupWorkspaceRestore,
} from "./startupRestore";
import type {
  Workspace,
  WorkspaceAnchorState,
  WorkspacesState,
} from "./workspaces";

describe("isSegmentLayoutValid", () => {
  it("rejects overlapping or nested segments", () => {
    expect(
      isSegmentLayoutValid(
        [
          { startLine: 1, lineCount: 4, fileIndex: 1 },
          { startLine: 2, lineCount: 2, fileIndex: 2 },
        ],
        "one\ntwo\nthree\nfour",
      ),
    ).toBe(false);
  });

  it("rejects fractional segment coordinates before mapper preparation", () => {
    expect(
      isSegmentLayoutValid(
        [{ startLine: 1.5, lineCount: 1, fileIndex: 1 }],
        "one\ntwo",
      ),
    ).toBe(false);
    expect(
      isSegmentLayoutValid(
        [{ startLine: 1, lineCount: 1, fileIndex: 1.5 }],
        "one",
      ),
    ).toBe(false);
  });

  it("accepts ordered non-overlapping segments with an unmanaged gap", () => {
    expect(
      isSegmentLayoutValid(
        [
          { startLine: 2, lineCount: 1, fileIndex: 1 },
          { startLine: 4, lineCount: 1, fileIndex: 2 },
        ],
        "prefix\none\ngap\ntwo",
      ),
    ).toBe(true);
  });
});

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

  it("keeps stale anchors excluded from validation so users can review them", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("current", {
          leftText: "left",
          rightText: "right",
          anchors: {
            ...emptyAnchors,
            staleManualAnchors: [
              {
                anchor: { leftLineNo: 12, rightLineNo: 14 },
                tracking: { leftLineNo: 1, rightLineNo: null },
                reason: "reload-unresolved",
              },
            ],
          },
        }),
      ],
    };

    const result = resolve(workspaceState, null);

    expect(result.initialAnchors.manualAnchors).toEqual([]);
    expect(result.initialAnchors.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 12, rightLineNo: 14 },
        tracking: { leftLineNo: 1, rightLineNo: null },
        reason: "reload-unresolved",
      },
    ]);
    expect(result.shouldPersistAnchors).toBe(false);
  });

  it("normalizes malformed stale tracking while restoring a workspace", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("current", {
          anchors: {
            ...emptyAnchors,
            staleManualAnchors: [
              {
                anchor: { leftLineNo: 2, rightLineNo: 3 },
                tracking: { leftLineNo: 4, rightLineNo: -1 },
                reason: "edit-unresolved",
              },
            ],
          },
        }),
      ],
    } as WorkspacesState;

    const result = resolve(workspaceState, null);

    expect(result.initialAnchors.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 3 },
        tracking: { leftLineNo: 4, rightLineNo: null },
        reason: "edit-unresolved",
      },
    ]);
    expect(result.shouldPersistAnchors).toBe(true);
  });

  it("keeps an active anchor when a historical stale anchor has the same coordinates", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("current", {
          leftText: "left",
          rightText: "right",
          anchors: {
            ...emptyAnchors,
            manualAnchors: [{ leftLineNo: 0, rightLineNo: 0 }],
            staleManualAnchors: [
              {
                anchor: { leftLineNo: 0, rightLineNo: 0 },
                reason: "edit-unresolved",
              },
            ],
            selectedAnchorKey: "manual:0:0",
          },
        }),
      ],
    };

    const result = resolve(workspaceState, null);

    expect(result.initialAnchors.manualAnchors).toEqual([
      { leftLineNo: 0, rightLineNo: 0 },
    ]);
    expect(result.initialAnchors.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 0, rightLineNo: 0 },
        reason: "edit-unresolved",
      },
    ]);
    expect(result.initialAnchors.selectedAnchorKey).toBe("manual:0:0");
  });

  it("migrates stale anchors from the legacy snapshot without reactivating them", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [createWorkspace("current")],
    };
    const persisted = createPersistedState({
      staleAnchors: [
        {
          anchor: { leftLineNo: 9, rightLineNo: 11 },
          tracking: { leftLineNo: null, rightLineNo: 13 },
          reason: "edit-unresolved",
        },
      ],
    });

    const result = resolve(workspaceState, persisted);

    expect(result.initialAnchors.manualAnchors).toEqual([
      { leftLineNo: 0, rightLineNo: 0 },
    ]);
    expect(result.initialAnchors.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 9, rightLineNo: 11 },
        tracking: { leftLineNo: null, rightLineNo: 13 },
        reason: "edit-unresolved",
      },
    ]);
  });

  it("keeps migrated active and historical stale anchors with the same coordinates", () => {
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [createWorkspace("current")],
    };
    const persisted = createPersistedState({
      staleAnchors: [
        {
          anchor: { leftLineNo: 0, rightLineNo: 0 },
          reason: "reload-unresolved",
        },
      ],
    });

    const result = resolve(workspaceState, persisted);

    expect(result.initialAnchors.manualAnchors).toEqual([
      { leftLineNo: 0, rightLineNo: 0 },
    ]);
    expect(result.initialAnchors.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 0, rightLineNo: 0 },
        reason: "reload-unresolved",
      },
    ]);
  });

  it("preserves workspace stale anchors while migrating legacy active anchors", () => {
    const staleManualAnchors: NonNullable<
      WorkspaceAnchorState["staleManualAnchors"]
    > = [
      {
        anchor: { leftLineNo: 9, rightLineNo: 11 },
        reason: "reload-unresolved",
      },
    ];
    const workspaceState: WorkspacesState = {
      selectedId: "current",
      workspaces: [
        createWorkspace("current", {
          anchors: {
            ...emptyAnchors,
            staleManualAnchors,
          },
        }),
      ],
    };

    const result = resolve(workspaceState, createPersistedState());

    expect(result.initialAnchors.manualAnchors).toEqual([
      { leftLineNo: 0, rightLineNo: 0 },
    ]);
    expect(result.initialAnchors.staleManualAnchors).toEqual(staleManualAnchors);
  });
});
