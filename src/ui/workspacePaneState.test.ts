import { describe, expect, it, vi } from "vitest";
import { applyPaneSnapshot, collectPaneSnapshot } from "./workspacePaneState";

describe("workspace pane snapshots", () => {
  it("collects pane data with segments and selection", () => {
    const segments = [
      { startLine: 1, lineCount: 3, fileIndex: 1, fileName: "alpha.txt" },
    ];
    const adapter = {
      getValue: () => "alpha",
      setValue: vi.fn(),
      getPosition: () => ({ lineNumber: 4, column: 2 }),
      setPosition: vi.fn(),
      getScrollTop: () => 120,
      setScrollTop: vi.fn(),
      getLineCount: () => 6,
    };

    const snapshot = collectPaneSnapshot(adapter, segments, "alpha.txt");

    expect(snapshot.text).toBe("alpha");
    expect(snapshot.activeFile).toBe("alpha.txt");
    expect(snapshot.cursor).toEqual({ lineNumber: 4, column: 2 });
    expect(snapshot.scrollTop).toBe(120);
    expect(snapshot.segments).toEqual(segments);
    expect(snapshot.segments).not.toBe(segments);
  });

  it("applies pane data and clamps cursor position", () => {
    const segments = [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "beta.txt" },
    ];
    const snapshot = {
      text: "beta",
      segments,
      activeFile: "beta.txt",
      cursor: { lineNumber: 10, column: 4 },
      scrollTop: 80,
    };
    const adapter = {
      getValue: () => "old",
      setValue: vi.fn(),
      getPosition: () => ({ lineNumber: 1, column: 1 }),
      setPosition: vi.fn(),
      getScrollTop: () => 0,
      setScrollTop: vi.fn(),
      getLineCount: () => 5,
    };
    const targetSegments: typeof segments = [];

    applyPaneSnapshot(adapter, targetSegments, snapshot);

    expect(adapter.setValue).toHaveBeenCalledWith("beta");
    expect(targetSegments).toEqual(segments);
    expect(adapter.setPosition).toHaveBeenCalledWith({ lineNumber: 5, column: 4 });
    expect(adapter.setScrollTop).toHaveBeenCalledWith(80);
  });

  it("can skip applying text", () => {
    const snapshot = {
      text: "next",
      segments: [
        { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "gamma.txt" },
      ],
      activeFile: null,
      cursor: null,
      scrollTop: null,
    };
    const adapter = {
      getValue: () => "current",
      setValue: vi.fn(),
    };
    const targetSegments: typeof snapshot.segments = [
      { startLine: 5, lineCount: 1, fileIndex: 2, fileName: "old.txt" },
    ];

    applyPaneSnapshot(adapter, targetSegments, snapshot, { applyText: false });

    expect(adapter.setValue).not.toHaveBeenCalled();
    expect(targetSegments).toEqual(snapshot.segments);
  });
});
