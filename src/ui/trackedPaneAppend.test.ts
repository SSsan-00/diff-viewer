import { describe, expect, it } from "vitest";
import { buildDecodedFiles, type FileBytes } from "../file/decodedFiles";
import type { WorkspaceAnchorState } from "../storage/workspaces";
import {
  prepareTrackedPaneAppend,
  runTrackedPaneAppendTransaction,
  sameTrackedPaneAppendContext,
  type TrackedPaneAppendContext,
} from "./trackedPaneAppend";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function anchorState(leftLineNo: number): WorkspaceAnchorState {
  return {
    manualAnchors: [{ leftLineNo, rightLineNo: 0 }],
    staleManualAnchors: [],
    autoAnchor: null,
    suppressedAutoAnchorKey: null,
    pendingLeftLineNo: leftLineNo,
    pendingRightLineNo: null,
    selectedAnchorKey: `manual:${leftLineNo}:0`,
  };
}

describe("prepareTrackedPaneAppend", () => {
  it("keeps anchors and pending rows in a non-empty unmanaged prefix", () => {
    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: "manual",
      currentSegments: [],
      incomingFiles: [{ name: "a.txt", bytes: bytes("A1") }],
      encoding: "utf-8",
      anchorState: anchorState(0),
      lineCounts: { leftLineCount: 1, rightLineCount: 1 },
    });

    expect(result.text).toBe("manual\nA1");
    expect(result.anchorResult.state.manualAnchors).toEqual([
      { leftLineNo: 0, rightLineNo: 0 },
    ]);
    expect(result.anchorResult.state.staleManualAnchors).toEqual([]);
    expect(result.anchorResult.state.pendingLeftLineNo).toBe(0);
  });

  it("keeps unmanaged rows before a trailing empty row but marks the consumed row stale", () => {
    const state: WorkspaceAnchorState = {
      manualAnchors: [
        { leftLineNo: 0, rightLineNo: 0 },
        { leftLineNo: 1, rightLineNo: 1 },
      ],
      staleManualAnchors: [],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: 1,
      pendingRightLineNo: null,
      selectedAnchorKey: "manual:1:1",
    };

    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: "manual\n",
      currentSegments: [],
      incomingFiles: [{ name: "a.txt", bytes: bytes("A1") }],
      encoding: "utf-8",
      anchorState: state,
      lineCounts: { leftLineCount: 2, rightLineCount: 2 },
    });

    expect(result.text).toBe("manual\nA1");
    expect(result.anchorResult.state.manualAnchors).toEqual([
      { leftLineNo: 0, rightLineNo: 0 },
    ]);
    expect(result.anchorResult.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        reason: "reload-unresolved",
        tracking: { leftLineNo: null, rightLineNo: 1 },
      },
    ]);
    expect(result.anchorResult.state.pendingLeftLineNo).toBeNull();
    expect(result.anchorResult.state.selectedAnchorKey).toBeNull();
  });

  it("keeps anchors and pending rows in an unmanaged suffix after a managed segment", () => {
    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: "managed\nunmanaged suffix",
      currentSegments: [
        {
          startLine: 1,
          lineCount: 1,
          fileIndex: 1,
          fileName: "managed.txt",
          endsWithNewline: false,
        },
      ],
      incomingFiles: [{ name: "next.txt", bytes: bytes("next") }],
      encoding: "utf-8",
      anchorState: anchorState(1),
      lineCounts: { leftLineCount: 2, rightLineCount: 1 },
    });

    expect(result.text).toBe("managed\nunmanaged suffix\nnext");
    expect(result.anchorResult.state.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 0 },
    ]);
    expect(result.anchorResult.state.staleManualAnchors).toEqual([]);
    expect(result.anchorResult.state.pendingLeftLineNo).toBe(1);
  });

  it("does not silently reuse the empty editor line for the first loaded file", () => {
    const incoming: FileBytes[] = [{ name: "a.txt", bytes: bytes("A1") }];

    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: "",
      currentSegments: [],
      incomingFiles: incoming,
      encoding: "utf-8",
      anchorState: anchorState(0),
      lineCounts: { leftLineCount: 1, rightLineCount: 1 },
    });

    expect(result.anchorResult.state.manualAnchors).toEqual([]);
    expect(result.anchorResult.state.staleManualAnchors).toEqual([
      {
        anchor: { leftLineNo: 0, rightLineNo: 0 },
        reason: "reload-unresolved",
        tracking: { leftLineNo: null, rightLineNo: 0 },
      },
    ]);
    expect(result.anchorResult.state.pendingLeftLineNo).toBeNull();
  });

  it("marks a replaced trailing empty line stale instead of moving it into the appended file", () => {
    const current = buildDecodedFiles(
      [{ name: "a.txt", bytes: bytes("A1\nA2\n") }],
      "utf-8",
    );

    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: current.text,
      currentSegments: current.segments,
      incomingFiles: [{ name: "b.txt", bytes: bytes("B1") }],
      encoding: "utf-8",
      anchorState: anchorState(2),
      lineCounts: { leftLineCount: 3, rightLineCount: 1 },
    });

    expect(result.text).toBe("A1\nA2\nB1");
    expect(result.anchorResult.state.manualAnchors).toEqual([]);
    expect(result.anchorResult.state.staleManualAnchors).toHaveLength(1);
    expect(result.anchorResult.state.pendingLeftLineNo).toBeNull();
  });

  it("keeps a uniquely identifiable existing file line active", () => {
    const current = buildDecodedFiles(
      [{ name: "a.txt", bytes: bytes("A1\nA2\n") }],
      "utf-8",
    );

    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: current.text,
      currentSegments: current.segments,
      incomingFiles: [{ name: "b.txt", bytes: bytes("B1") }],
      encoding: "utf-8",
      anchorState: anchorState(1),
      lineCounts: { leftLineCount: 3, rightLineCount: 1 },
    });

    expect(result.anchorResult.state.manualAnchors).toEqual([
      { leftLineNo: 1, rightLineNo: 0 },
    ]);
    expect(result.anchorResult.state.staleManualAnchors).toEqual([]);
    expect(result.anchorResult.state.pendingLeftLineNo).toBe(1);
  });

  it("keeps duplicate non-empty lines at their file-local positions when appending", () => {
    const current = buildDecodedFiles(
      [{ name: "a.txt", bytes: bytes("A\nA\n") }],
      "utf-8",
    );
    const state: WorkspaceAnchorState = {
      manualAnchors: [
        { leftLineNo: 0, rightLineNo: 0 },
        { leftLineNo: 1, rightLineNo: 1 },
      ],
      staleManualAnchors: [],
      autoAnchor: null,
      suppressedAutoAnchorKey: null,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      selectedAnchorKey: "manual:1:1",
    };

    const result = prepareTrackedPaneAppend({
      side: "left",
      currentText: current.text,
      currentSegments: current.segments,
      incomingFiles: [{ name: "b.txt", bytes: bytes("B") }],
      encoding: "utf-8",
      anchorState: state,
      lineCounts: { leftLineCount: 3, rightLineCount: 2 },
    });

    expect(result.anchorResult.state.manualAnchors).toEqual(
      state.manualAnchors,
    );
    expect(result.anchorResult.state.staleManualAnchors).toEqual([]);
    expect(result.anchorResult.state.selectedAnchorKey).toBe("manual:1:1");
  });
});

describe("runTrackedPaneAppendTransaction", () => {
  const initialContext: TrackedPaneAppendContext = {
    side: "left",
    operationGeneration: 3,
    workspaceId: "workspace-a",
    contentRevision: 7,
    modelVersionId: 11,
    selectedEncoding: "utf-8",
    segmentsSignature: "segments-a",
    saveTargetsRevision: 2,
  };

  it.each([
    ["operation generation", { operationGeneration: 4 }],
    ["workspace", { workspaceId: "workspace-b" }],
    ["target pane content", { contentRevision: 8 }],
    ["target model", { modelVersionId: 12 }],
    ["encoding", { selectedEncoding: "shift_jis" as const }],
    ["segments", { segmentsSignature: "segments-b" }],
    ["save targets", { saveTargetsRevision: 3 }],
  ])("does not commit after %s changes while a file is loading", async (_, change) => {
    let finishLoad: ((value: string) => void) | null = null;
    const loaded = new Promise<string>((resolve) => {
      finishLoad = resolve;
    });
    let currentContext = initialContext;
    const committed: string[] = [];
    const transaction = runTrackedPaneAppendTransaction({
      items: ["file"],
      load: () => loaded,
      prepare: (items) => items.join(""),
      commit: (value) => committed.push(value),
      commitGuard: {
        expectedContext: initialContext,
        isCurrent: (expected) =>
          sameTrackedPaneAppendContext(expected, currentContext),
      },
    });

    currentContext = { ...currentContext, ...change };
    finishLoad?.("loaded");

    await expect(transaction).resolves.toEqual({
      status: "context-changed",
      expectedContext: initialContext,
    });
    expect(committed).toEqual([]);
  });

  it("does commit when only the opposite pane changes", async () => {
    let oppositePaneRevision = 1;
    const committed: string[] = [];
    const transaction = runTrackedPaneAppendTransaction({
      items: ["loaded"],
      load: async (value) => value,
      prepare: (items) => items.join(""),
      commit: (value) => committed.push(value),
      commitGuard: {
        expectedContext: initialContext,
        isCurrent: (expected) => {
          void oppositePaneRevision;
          return sameTrackedPaneAppendContext(expected, initialContext);
        },
      },
    });

    oppositePaneRevision += 1;

    await expect(transaction).resolves.toEqual({
      status: "committed",
      prepared: "loaded",
    });
    expect(committed).toEqual(["loaded"]);
  });

  it("leaves text, segments, raw bytes, and anchors untouched after target-pane drift", async () => {
    const live = {
      text: "edited while loading",
      segments: [{ startLine: 1, lineCount: 1 }],
      raw: [1],
      anchors: [2],
    };
    const before = structuredClone(live);
    const currentContext = { ...initialContext, contentRevision: 8 };

    const result = await runTrackedPaneAppendTransaction({
      items: ["file"],
      load: async () => "loaded",
      prepare: () => ({
        text: "replacement",
        segments: [{ startLine: 2, lineCount: 1 }],
        raw: [9],
        anchors: [10],
      }),
      commit: (prepared) => {
        live.text = prepared.text;
        live.segments = prepared.segments;
        live.raw = prepared.raw;
        live.anchors = prepared.anchors;
      },
      commitGuard: {
        expectedContext: initialContext,
        isCurrent: (expected) =>
          sameTrackedPaneAppendContext(expected, currentContext),
      },
    });

    expect(result.status).toBe("context-changed");
    expect(live).toEqual(before);
  });
});
