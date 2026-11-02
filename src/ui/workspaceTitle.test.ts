import { expect, it } from "vitest";
import { getWorkspaceTitle } from "./workspaceTitle";
import type { WorkspacesState } from "../storage/workspaces";

it("uses the selected workspace and falls back when it is missing", () => {
  const workspaces: WorkspacesState["workspaces"] = ["Alpha", "Beta"].map((name, index) => ({
    id: `ws-${index}`, name, leftText: "", rightText: "",
    anchors: { manualAnchors: [], autoAnchor: null, suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null, pendingRightLineNo: null, selectedAnchorKey: null },
  }));
  expect(getWorkspaceTitle({workspaces, selectedId: "ws-1"})).toBe("Beta");
  expect(getWorkspaceTitle({workspaces, selectedId: "missing"})).toBe("Alpha");
});
