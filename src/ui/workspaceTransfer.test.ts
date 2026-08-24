import { describe, expect, it } from "vitest";
import type { Workspace } from "../storage/workspaces";
import {
  buildWorkspaceTransferPayload,
  parseWorkspaceTransferPayload,
} from "./workspaceTransfer";

describe("workspace transfer", () => {
  const workspace: Workspace = {
    id: "ws-1",
    name: "Alpha",
    leftText: "left",
    rightText: "right",
    leftSegments: [
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "left.html" },
    ],
    rightSegments: [
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "right.html" },
    ],
    leftActiveFile: "left.html",
    rightActiveFile: "right.html",
    leftCursor: { lineNumber: 1, column: 1 },
    rightCursor: { lineNumber: 1, column: 2 },
    leftScrollTop: 10,
    rightScrollTop: 20,
    anchors: {
      manualAnchors: [{ leftLineNo: 0, rightLineNo: 0 }],
      staleManualAnchors: [
        {
          anchor: { leftLineNo: 5, rightLineNo: 6 },
          reason: "reload-unresolved",
        },
      ],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: "manual:0:0",
    },
  };

  it("exports the selected workspace without its storage id", () => {
    const payload = buildWorkspaceTransferPayload(workspace);

    expect(payload.kind).toBe("diff-viewer-workspace");
    expect(payload.version).toBe(1);
    expect(payload.workspace).toMatchObject({
      name: "Alpha",
      leftText: "left",
      rightText: "right",
      leftSegments: [{ fileName: "left.html" }],
      rightSegments: [{ fileName: "right.html" }],
      anchors: {
        manualAnchors: [{ leftLineNo: 0, rightLineNo: 0 }],
        staleManualAnchors: [
          {
            anchor: { leftLineNo: 5, rightLineNo: 6 },
            reason: "reload-unresolved",
          },
        ],
      },
    });
    expect("id" in payload.workspace).toBe(false);
  });

  it("parses workspace payloads and keeps file names while omitting file handles", () => {
    const payload = buildWorkspaceTransferPayload(workspace);
    const parsed = parseWorkspaceTransferPayload(payload);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.workspace.name).toBe("Alpha");
    expect(parsed.workspace.leftSegments[0]?.fileName).toBe("left.html");
    expect(parsed.workspace.rightSegments[0]?.fileName).toBe("right.html");
    expect(parsed.workspace.anchors.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 5, rightLineNo: 6 },
        reason: "reload-unresolved",
      },
    ]);
    expect("saveTargets" in parsed.workspace).toBe(false);
  });

  it("normalizes missing stale anchors from older version 1 payloads", () => {
    const payload = buildWorkspaceTransferPayload(workspace);
    delete (payload.workspace.anchors as Partial<typeof payload.workspace.anchors>)
      .staleManualAnchors;

    const parsed = parseWorkspaceTransferPayload(payload);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.workspace.anchors.staleManualAnchors).toEqual([]);
    }
  });
});
