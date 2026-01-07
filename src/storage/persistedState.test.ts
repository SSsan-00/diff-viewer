import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import {
  STORAGE_KEY,
  createPersistScheduler,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from "./persistedState";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

function createState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
    leftText: "left content",
    rightText: "right content",
    leftEncoding: "utf-8",
    rightEncoding: "shift_jis",
    scrollSync: false,
    foldEnabled: true,
    anchorPanelCollapsed: true,
    anchors: [{ leftLineNo: 0, rightLineNo: 1 }],
    leftSegments: [{ startLine: 1, lineCount: 2, fileIndex: 1, fileName: "a.txt" }],
    rightSegments: [{ startLine: 1, lineCount: 3, fileIndex: 1, fileName: "b.txt" }],
    ...overrides,
  };
}

describe("persisted state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves and restores text and ui state", () => {
    const storage = createStorage();
    let state = createState();

    const scheduler = createPersistScheduler({
      storage,
      getState: () => state,
      delayMs: 50,
    });

    scheduler.schedule();
    vi.runAllTimers();

    const restored = loadPersistedState(storage, STORAGE_KEY);
    expect(restored).toBeTruthy();
    expect(restored?.leftText).toBe("left content");
    expect(restored?.rightText).toBe("right content");
    expect(restored?.scrollSync).toBe(false);
    expect(restored?.foldEnabled).toBe(true);
    expect(restored?.anchorPanelCollapsed).toBe(true);
    expect(restored?.anchors.length).toBe(1);
  });

  it("keeps cleared pane content after save", () => {
    const storage = createStorage();
    let state = createState();
    savePersistedState(storage, state);

    state = createState({ leftText: "", rightText: "right content" });
    const scheduler = createPersistScheduler({
      storage,
      getState: () => state,
      delayMs: 10,
    });
    scheduler.schedule();
    vi.runAllTimers();

    const restored = loadPersistedState(storage, STORAGE_KEY);
    expect(restored?.leftText).toBe("");
    expect(restored?.rightText).toBe("right content");
  });
});
