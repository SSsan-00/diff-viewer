import { describe, expect, it } from "vitest";
import { getWorkspaceTitle } from "./workspaceTitle";
import type { WorkspacesState } from "../storage/workspaces";

describe("workspace title", () => {
  it("returns the selected workspace name", () => {
    const state: WorkspacesState = {
      workspaces: [{ id: "ws-a", name: "Alpha" }],
      selectedId: "ws-a",
    };

    expect(getWorkspaceTitle(state)).toBe("Alpha");
  });

  it("falls back to the first workspace when selection is missing", () => {
    const state: WorkspacesState = {
      workspaces: [
        { id: "ws-a", name: "Alpha" },
        { id: "ws-b", name: "Beta" },
      ],
      selectedId: "ws-missing",
    };

    expect(getWorkspaceTitle(state)).toBe("Alpha");
  });
});
