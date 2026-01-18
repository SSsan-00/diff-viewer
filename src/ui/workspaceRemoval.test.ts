import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { removeWorkspaceWithConfirm } from "./workspaceRemoval";
import type { WorkspacesState } from "../storage/workspaces";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

describe("workspace removal confirmation", () => {
  it("cancels deletion when confirm is false", () => {
    const storage = createStorage();
    const state: WorkspacesState = {
      workspaces: [
        { id: "ws-a", name: "Alpha" },
        { id: "ws-b", name: "Beta" },
      ],
      selectedId: "ws-a",
    };
    const confirm = vi.fn(() => false);

    const result = removeWorkspaceWithConfirm(storage, state, "ws-b", confirm);

    expect(confirm).toHaveBeenCalledWith(
      "ワークスペース「Beta」を削除します。よろしいですか？",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("cancelled");
    }
    expect(result.state).toBe(state);
  });

  it("deletes when confirm is true and updates selected workspace", () => {
    const storage = createStorage();
    const state: WorkspacesState = {
      workspaces: [
        { id: "ws-a", name: "Alpha" },
        { id: "ws-b", name: "Beta" },
      ],
      selectedId: "ws-b",
    };
    const confirm = vi.fn(() => true);

    const result = removeWorkspaceWithConfirm(storage, state, "ws-b", confirm);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.workspaces).toEqual([{ id: "ws-a", name: "Alpha" }]);
      expect(result.state.selectedId).toBe("ws-a");
    }
  });

  it("rejects deletion when only one workspace remains", () => {
    const storage = createStorage();
    const state: WorkspacesState = {
      workspaces: [{ id: "ws-a", name: "Alpha" }],
      selectedId: "ws-a",
    };
    const confirm = vi.fn(() => true);

    const result = removeWorkspaceWithConfirm(storage, state, "ws-a", confirm);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("last");
    }
  });
});
