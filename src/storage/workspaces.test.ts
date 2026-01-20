import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  createWorkspace,
  deleteWorkspace,
  loadWorkspaces,
  renameWorkspace,
  reorderWorkspaces,
  setWorkspacePaneState,
  setWorkspaceAnchors,
  setWorkspaceTexts,
  selectWorkspace,
  WORKSPACE_LIMIT,
  WORKSPACE_NAME_LIMIT,
  type WorkspacesState,
} from "./workspaces";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

function createState(names: string[]): WorkspacesState {
  const workspaces = names.map((name, index) => ({
    id: `ws-${index}`,
    name,
    leftText: "",
    rightText: "",
    anchors: {
      manualAnchors: [],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: null,
    },
  }));
  return { workspaces, selectedId: workspaces[0]?.id ?? "" };
}

describe("workspaces storage", () => {
  it("creates a default workspace when storage is empty", () => {
    const storage = createStorage();
    const state = loadWorkspaces(storage);
    expect(state.workspaces.length).toBe(1);
    expect(state.selectedId).toBe(state.workspaces[0]?.id);
  });

  it("enforces name length limit on create", () => {
    const storage = createStorage();
    const state = loadWorkspaces(storage);
    const tooLong = "a".repeat(WORKSPACE_NAME_LIMIT + 1);
    const result = createWorkspace(storage, state, tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("length");
    }
  });

  it("enforces the max workspace limit", () => {
    const storage = createStorage();
    const base = loadWorkspaces(storage);
    let state: WorkspacesState = base;
    for (let i = 0; i < WORKSPACE_LIMIT - 1; i += 1) {
      const result = createWorkspace(storage, state, `Workspace ${i + 1}`);
      if (result.ok) {
        state = result.state;
      }
    }
    const overflow = createWorkspace(storage, state, "Overflow");
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) {
      expect(overflow.reason).toBe("limit");
    }
  });

  it("prevents deleting the last workspace", () => {
    const storage = createStorage();
    const state = loadWorkspaces(storage);
    const result = deleteWorkspace(storage, state, state.selectedId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("last");
    }
  });

  it("reorders workspaces by index", () => {
    const storage = createStorage();
    const state = createState(["A", "B", "C"]);
    const result = reorderWorkspaces(storage, state, 0, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.workspaces.map((item) => item.name)).toEqual([
        "B",
        "C",
        "A",
      ]);
    }
  });

  it("renames and selects workspaces", () => {
    const storage = createStorage();
    const state = createState(["Alpha", "Beta"]);
    const renamed = renameWorkspace(storage, state, "ws-1", "Gamma");
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      expect(
        renamed.state.workspaces.find((item) => item.id === "ws-1")?.name,
      ).toBe("Gamma");
    }
    const selected = selectWorkspace(storage, state, "ws-1");
    expect(selected.ok).toBe(true);
    if (selected.ok) {
      expect(selected.state.selectedId).toBe("ws-1");
    }
  });

  it("stores pane texts per workspace", () => {
    const storage = createStorage();
    const state = createState(["Alpha", "Beta"]);
    const updated = setWorkspaceTexts(storage, state, "ws-0", "left-a", "right-a");
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      const stored = loadWorkspaces(storage);
      const alpha = stored.workspaces.find((item) => item.id === "ws-0");
      const beta = stored.workspaces.find((item) => item.id === "ws-1");
      expect(alpha?.leftText).toBe("left-a");
      expect(alpha?.rightText).toBe("right-a");
      expect(beta?.leftText).toBe("");
      expect(beta?.rightText).toBe("");
    }
  });

  it("stores pane metadata per workspace", () => {
    const storage = createStorage();
    const state = createState(["Alpha", "Beta"]);
    const segments = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "alpha.txt" },
    ];
    const updated = setWorkspacePaneState(storage, state, "ws-0", "left", {
      text: "left-a",
      segments,
      activeFile: "alpha.txt",
      cursor: { lineNumber: 2, column: 1 },
      scrollTop: 120,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      const stored = loadWorkspaces(storage);
      const alpha = stored.workspaces.find((item) => item.id === "ws-0");
      const beta = stored.workspaces.find((item) => item.id === "ws-1");
      expect(alpha?.leftText).toBe("left-a");
      expect(alpha?.leftSegments).toEqual(segments);
      expect(alpha?.leftActiveFile).toBe("alpha.txt");
      expect(alpha?.leftCursor?.lineNumber).toBe(2);
      expect(alpha?.leftScrollTop).toBe(120);
      expect(beta?.leftSegments ?? []).toHaveLength(0);
    }
  });

  it("stores anchors per workspace", () => {
    const storage = createStorage();
    const state = createState(["Alpha", "Beta"]);
    const result = setWorkspaceAnchors(storage, state, "ws-1", {
      manualAnchors: [{ leftLineNo: 1, rightLineNo: 2 }],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: "manual:1:2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const stored = loadWorkspaces(storage);
      const beta = stored.workspaces.find((item) => item.id === "ws-1");
      const alpha = stored.workspaces.find((item) => item.id === "ws-0");
      expect(beta?.anchors.manualAnchors).toHaveLength(1);
      expect(beta?.anchors.selectedAnchorKey).toBe("manual:1:2");
      expect(alpha?.anchors.manualAnchors).toHaveLength(0);
    }
  });
});
