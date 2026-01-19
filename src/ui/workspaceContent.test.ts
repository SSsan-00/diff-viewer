import { describe, expect, it, vi } from "vitest";
import { applyWorkspaceSwitch, applyWorkspaceSwitchWithHooks } from "./workspaceContent";
import type { WorkspacesState } from "../storage/workspaces";

describe("applyWorkspaceSwitch", () => {
  it("captures current editor values and applies the next workspace text", () => {
    const state: WorkspacesState = {
      selectedId: "ws-a",
      workspaces: [
        {
          id: "ws-a",
          name: "Alpha",
          leftText: "left-a",
          rightText: "right-a",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
        {
          id: "ws-b",
          name: "Beta",
          leftText: "left-b",
          rightText: "right-b",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
    };
    const left = { getValue: vi.fn(() => "left-current"), setValue: vi.fn() };
    const right = { getValue: vi.fn(() => "right-current"), setValue: vi.fn() };

    const nextState = applyWorkspaceSwitch(state, "ws-b", { left, right });

    expect(left.getValue).toHaveBeenCalledTimes(1);
    expect(right.getValue).toHaveBeenCalledTimes(1);
    expect(left.setValue).toHaveBeenCalledWith("left-b");
    expect(right.setValue).toHaveBeenCalledWith("right-b");
    const updated = nextState.workspaces.find((workspace) => workspace.id === "ws-a");
    expect(updated?.leftText).toBe("left-current");
    expect(updated?.rightText).toBe("right-current");
    expect(nextState.selectedId).toBe("ws-b");
  });

  it("runs after-restore hooks after updating editor values", () => {
    const calls: string[] = [];
    const state: WorkspacesState = {
      selectedId: "ws-a",
      workspaces: [
        {
          id: "ws-a",
          name: "Alpha",
          leftText: "left-a",
          rightText: "right-a",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
        {
          id: "ws-b",
          name: "Beta",
          leftText: "left-b",
          rightText: "right-b",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
    };
    const left = {
      getValue: vi.fn(() => {
        calls.push("get-left");
        return "left-current";
      }),
      setValue: vi.fn(() => {
        calls.push("set-left");
      }),
    };
    const right = {
      getValue: vi.fn(() => {
        calls.push("get-right");
        return "right-current";
      }),
      setValue: vi.fn(() => {
        calls.push("set-right");
      }),
    };

    applyWorkspaceSwitchWithHooks(state, "ws-b", { left, right }, {
      onAfterRestore: () => calls.push("after-restore"),
    });

    expect(calls.indexOf("after-restore")).toBeGreaterThan(calls.indexOf("set-left"));
    expect(calls.indexOf("after-restore")).toBeGreaterThan(calls.indexOf("set-right"));
  });

  it("preserves workspace anchor state during text switching", () => {
    const state: WorkspacesState = {
      selectedId: "ws-a",
      workspaces: [
        {
          id: "ws-a",
          name: "Alpha",
          leftText: "left-a",
          rightText: "right-a",
          anchors: {
            manualAnchors: [{ leftLineNo: 1, rightLineNo: 2 }],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: "manual:1:2",
          },
        },
        {
          id: "ws-b",
          name: "Beta",
          leftText: "left-b",
          rightText: "right-b",
          anchors: {
            manualAnchors: [{ leftLineNo: 3, rightLineNo: 4 }],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: "manual:3:4",
          },
        },
      ],
    };
    const left = { getValue: vi.fn(() => "left-current"), setValue: vi.fn() };
    const right = { getValue: vi.fn(() => "right-current"), setValue: vi.fn() };

    const nextState = applyWorkspaceSwitch(state, "ws-b", { left, right });
    const alpha = nextState.workspaces.find((workspace) => workspace.id === "ws-a");
    const beta = nextState.workspaces.find((workspace) => workspace.id === "ws-b");

    expect(alpha?.anchors.selectedAnchorKey).toBe("manual:1:2");
    expect(beta?.anchors.selectedAnchorKey).toBe("manual:3:4");
  });
});
