import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  createWorkspace,
  deleteWorkspace,
  loadWorkspaces,
  renameWorkspace,
  reorderWorkspaces,
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
});
