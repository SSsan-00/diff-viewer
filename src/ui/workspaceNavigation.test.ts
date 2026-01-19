import { describe, expect, it, vi } from "vitest";
import {
  getNextWorkspaceId,
  handleWorkspaceNavigation,
} from "./workspaceNavigation";
import type { Workspace } from "../storage/workspaces";

const workspaces: Workspace[] = [
  {
    id: "ws-a",
    name: "Alpha",
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
  },
  {
    id: "ws-b",
    name: "Beta",
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
  },
  {
    id: "ws-c",
    name: "Gamma",
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
  },
];

describe("workspace navigation", () => {
  it("moves selection down and up within bounds", () => {
    expect(getNextWorkspaceId(workspaces, "ws-a", 1)).toBe("ws-b");
    expect(getNextWorkspaceId(workspaces, "ws-b", 1)).toBe("ws-c");
    expect(getNextWorkspaceId(workspaces, "ws-c", 1)).toBe("ws-c");
    expect(getNextWorkspaceId(workspaces, "ws-c", -1)).toBe("ws-b");
    expect(getNextWorkspaceId(workspaces, "ws-a", -1)).toBe("ws-a");
  });

  it("falls back to the first workspace when selection is missing", () => {
    expect(getNextWorkspaceId(workspaces, "missing", 1)).toBe("ws-b");
    expect(getNextWorkspaceId(workspaces, "missing", -1)).toBe("ws-a");
  });

  it("handles keyboard events and calls onSelect", () => {
    const selections: string[] = [];
    const event = {
      key: "ArrowDown",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    const handled = handleWorkspaceNavigation(event, {
      workspaces,
      selectedId: "ws-a",
      onSelect: (id) => selections.push(id),
    });

    expect(handled).toBe(true);
    expect(selections).toEqual(["ws-b"]);
  });
});
