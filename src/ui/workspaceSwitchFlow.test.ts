import { describe, expect, it, vi } from "vitest";
import { runWorkspaceSwitch } from "./workspaceSwitchFlow";
import type { WorkspacesState, WorkspaceAnchorState } from "../storage/workspaces";

function createState(): WorkspacesState {
  return {
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
}

describe("runWorkspaceSwitch", () => {
  it("updates state, restores text, and fires hooks in order", () => {
    const state = createState();
    const calls: string[] = [];
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
    const next = runWorkspaceSwitch(
      state,
      "ws-b",
      { left, right },
      state.workspaces[0].anchors,
      {
        onAfterRestore: () => calls.push("after-restore"),
        onAfterSwitch: () => calls.push("after-switch"),
      },
    );

    expect(next.selectedId).toBe("ws-b");
    expect(left.setValue).toHaveBeenCalledWith("left-b");
    expect(right.setValue).toHaveBeenCalledWith("right-b");
    expect(calls.indexOf("after-restore")).toBeGreaterThan(calls.indexOf("set-left"));
    expect(calls.indexOf("after-switch")).toBeGreaterThan(
      calls.indexOf("after-restore"),
    );
  });

  it("persists current anchors and restores target anchors", () => {
    const state = createState();
    const left = { getValue: vi.fn(() => "left-current"), setValue: vi.fn() };
    const right = { getValue: vi.fn(() => "right-current"), setValue: vi.fn() };
    const currentAnchors: WorkspaceAnchorState = {
      manualAnchors: [{ leftLineNo: 5, rightLineNo: 6 }],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: "manual:5:6",
    };
    let restoredAnchorCount = -1;

    const next = runWorkspaceSwitch(state, "ws-b", { left, right }, currentAnchors, {
      onAfterRestore: (_state, target) => {
        restoredAnchorCount = target.anchors.manualAnchors.length;
      },
    });

    const saved = next.workspaces.find((workspace) => workspace.id === "ws-a");
    expect(saved?.anchors.manualAnchors).toHaveLength(1);
    expect(saved?.anchors.selectedAnchorKey).toBe("manual:5:6");
    expect(restoredAnchorCount).toBe(0);
  });
});
