import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { getDiffBlockStarts } from "../diffEngine/diffBlocks";
import { diffLines } from "../diffEngine/diffLines";
import { pairReplace } from "../diffEngine/pairReplace";
import {
  createWorkspace,
  deleteWorkspace,
  loadWorkspaces,
  renameWorkspace,
  reorderWorkspaces,
  saveWorkspaces,
  setWorkspacePaneState,
  setWorkspaceAnchors,
  setWorkspaceTexts,
  selectWorkspace,
  WORKSPACE_LIMIT,
  WORKSPACE_NAME_LIMIT,
  type WorkspacesState,
} from "./workspaces";
import type { TextStore } from "./textStore";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

function createTextStore(): TextStore & { texts: Map<string, string> } {
  const texts = new Map<string, string>();
  return {
    isAvailable: true,
    texts,
    get: async (key) => texts.get(key) ?? null,
    set: async (key, value) => {
      texts.set(key, value);
    },
    delete: async (key) => {
      texts.delete(key);
    },
  };
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
  it("creates a default workspace when storage is empty", async () => {
    const storage = createStorage();
    const state = await loadWorkspaces(storage);
    expect(state.workspaces.length).toBe(1);
    expect(state.selectedId).toBe(state.workspaces[0]?.id);
  });

  it("enforces name length limit on create", async () => {
    const storage = createStorage();
    const state = await loadWorkspaces(storage);
    const tooLong = "a".repeat(WORKSPACE_NAME_LIMIT + 1);
    const result = createWorkspace(storage, state, tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("length");
    }
  });

  it("enforces the max workspace limit", async () => {
    const storage = createStorage();
    const base = await loadWorkspaces(storage);
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

  it("prevents deleting the last workspace", async () => {
    const storage = createStorage();
    const state = await loadWorkspaces(storage);
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

  it("stores pane texts per workspace", async () => {
    const storage = createStorage();
    const state = createState(["Alpha", "Beta"]);
    const updated = setWorkspaceTexts(storage, state, "ws-0", "left-a", "right-a");
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      const stored = await loadWorkspaces(storage);
      const alpha = stored.workspaces.find((item) => item.id === "ws-0");
      const beta = stored.workspaces.find((item) => item.id === "ws-1");
      expect(alpha?.leftText).toBe("left-a");
      expect(alpha?.rightText).toBe("right-a");
      expect(beta?.leftText).toBe("");
      expect(beta?.rightText).toBe("");
    }
  });

  it("stores pane metadata per workspace", async () => {
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
      const stored = await loadWorkspaces(storage);
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

  it("stores anchors per workspace", async () => {
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
      const stored = await loadWorkspaces(storage);
      const beta = stored.workspaces.find((item) => item.id === "ws-1");
      const alpha = stored.workspaces.find((item) => item.id === "ws-0");
      expect(beta?.anchors.manualAnchors).toHaveLength(1);
      expect(beta?.anchors.selectedAnchorKey).toBe("manual:1:2");
      expect(alpha?.anchors.manualAnchors).toHaveLength(0);
    }
  });

  it("does not throw when workspace persistence fails", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    } as Storage;

    expect(() => loadWorkspaces(storage)).not.toThrow();

    const state = createState(["Alpha"]);
    expect(() =>
      setWorkspacePaneState(storage, state, "ws-0", "left", {
        text: "large text",
        segments: [],
        activeFile: null,
        cursor: null,
        scrollTop: null,
      }),
    ).not.toThrow();
  });

  it("migrates inline workspace text into the text store when available", async () => {
    const storage = createStorage();
    const textStore = createTextStore();
    const state = createState(["Alpha"]);
    const updated = setWorkspacePaneState(storage, state, "ws-0", "left", {
      text: "legacy left",
      segments: [],
      activeFile: null,
      cursor: null,
      scrollTop: null,
    });

    expect(updated.ok).toBe(true);

    const restored = await loadWorkspaces(storage, { textStore });
    const raw = JSON.parse(storage.getItem(storage.key(0) ?? "") ?? "{}");
    const alpha = restored.workspaces.find((item) => item.id === "ws-0");

    expect(alpha?.leftText).toBe("legacy left");
    expect(raw.workspaces[0].leftText).toBe("legacy left");
    expect(raw.textStorage).toBe("indexeddb");
    expect(textStore.texts.size).toBeGreaterThan(0);
  });

  it("restores small workspace text from localStorage fallback when IndexedDB text is missing", async () => {
    const storage = createStorage();
    const textStore = createTextStore();
    const state = createState(["Alpha"]);

    await saveWorkspaces(
      storage,
      {
        ...state,
        workspaces: state.workspaces.map((workspace) => ({
          ...workspace,
          leftText: "left fallback",
          rightText: "right fallback",
        })),
      },
      { textStore },
    );
    textStore.texts.clear();

    const restored = await loadWorkspaces(storage, { textStore });
    const alpha = restored.workspaces.find((item) => item.id === "ws-0");

    expect(alpha?.leftText).toBe("left fallback");
    expect(alpha?.rightText).toBe("right fallback");
    expect(
      getDiffBlockStarts(
        pairReplace(diffLines(alpha?.leftText ?? "", alpha?.rightText ?? "")),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("does not keep large workspace text inline in localStorage fallback", async () => {
    const storage = createStorage();
    const textStore = createTextStore();
    const largeText = "line\n".repeat(60000);
    const state = createState(["Alpha"]);

    await saveWorkspaces(
      storage,
      {
        ...state,
        workspaces: state.workspaces.map((workspace) => ({
          ...workspace,
          leftText: largeText,
          rightText: largeText,
        })),
      },
      { textStore },
    );

    const raw = JSON.parse(storage.getItem(storage.key(0) ?? "") ?? "{}");

    expect(raw.workspaces[0].leftText).toBe("");
    expect(raw.workspaces[0].rightText).toBe("");
    expect(raw.textStorage).toBe("indexeddb");
    expect(textStore.texts.get("diffViewer.workspaces:text:ws-0:left")).toBe(largeText);
    expect(textStore.texts.get("diffViewer.workspaces:text:ws-0:right")).toBe(largeText);
  });

  it("prefers inline workspace text over stale text-store data after fallback persistence", async () => {
    const storage = createStorage();
    const staleTextStore = createTextStore();
    const fallbackTextStore: TextStore = {
      isAvailable: true,
      get: staleTextStore.get,
      set: async () => {
        throw new Error("idb write failed");
      },
      delete: staleTextStore.delete,
    };
    const state = createState(["Alpha"]);

    staleTextStore.texts.set("diffViewer.workspaces:text:ws-0:left", "stale left");
    staleTextStore.texts.set("diffViewer.workspaces:text:ws-0:right", "stale right");

    const updated = setWorkspaceTexts(
      storage,
      state,
      "ws-0",
      "fresh left",
      "fresh right",
      { textStore: fallbackTextStore },
    );

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      await saveWorkspaces(storage, updated.state, { textStore: fallbackTextStore });
    }

    const restored = await loadWorkspaces(storage, { textStore: staleTextStore });
    const alpha = restored.workspaces.find((item) => item.id === "ws-0");

    expect(alpha?.leftText).toBe("fresh left");
    expect(alpha?.rightText).toBe("fresh right");
  });
});
