import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import { getDiffBlockStarts } from "../diffEngine/diffBlocks";
import { diffLines } from "../diffEngine/diffLines";
import { pairReplace } from "../diffEngine/pairReplace";
import {
  STORAGE_KEY,
  createPersistScheduler,
  loadPersistedState,
  saveInlinePersistedStateSnapshot,
  savePersistedState,
  type PersistedState,
} from "./persistedState";
import type { TextStore } from "./textStore";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

function createTextStore(): TextStore & { texts: Map<string, string> } {
  const texts = new Map<string, string>();
  return {
    isAvailable: true,
    texts,
    get: async (key) => texts.get(key) ?? null,
    set: async (key, value) => {
      texts.set(key, value);
    },
    delete: async (key) => {
      texts.delete(key);
    },
  };
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
    staleAnchors: [
      {
        anchor: { leftLineNo: 4, rightLineNo: 5 },
        tracking: { leftLineNo: null, rightLineNo: 7 },
        reason: "reload-unresolved",
      },
    ],
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

  it("saves and restores text and ui state", async () => {
    const storage = createStorage();
    let state = createState();

    const scheduler = createPersistScheduler({
      storage,
      getState: () => state,
      delayMs: 50,
    });

    scheduler.schedule();
    await vi.runAllTimersAsync();

    const restored = await loadPersistedState(storage, { key: STORAGE_KEY });
    expect(restored).toBeTruthy();
    expect(restored?.leftText).toBe("left content");
    expect(restored?.rightText).toBe("right content");
    expect(restored?.scrollSync).toBe(false);
    expect(restored?.foldEnabled).toBe(true);
    expect(restored?.anchorPanelCollapsed).toBe(true);
    expect(restored?.anchors.length).toBe(1);
    expect(restored?.staleAnchors).toEqual([
      {
        anchor: { leftLineNo: 4, rightLineNo: 5 },
        tracking: { leftLineNo: null, rightLineNo: 7 },
        reason: "reload-unresolved",
      },
    ]);
  });

  it("normalizes missing stale anchors from version 1 snapshots", async () => {
    const storage = createStorage();
    const legacy = createState();
    delete (legacy as Partial<PersistedState>).staleAnchors;
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const restored = await loadPersistedState(storage);

    expect(restored?.staleAnchors).toEqual([]);
  });

  it("keeps legacy stale anchors without synthesizing tracking", async () => {
    const storage = createStorage();
    const legacy = createState({
      staleAnchors: [
        {
          anchor: { leftLineNo: 2, rightLineNo: 3 },
          reason: "edit-unresolved",
        },
      ],
    });
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const restored = await loadPersistedState(storage);

    expect(restored?.staleAnchors).toEqual(legacy.staleAnchors);
    expect(restored?.staleAnchors?.[0]).not.toHaveProperty("tracking");
  });

  it("normalizes malformed stale tracking per side", async () => {
    const storage = createStorage();
    const malformed = createState();
    malformed.staleAnchors = [
      {
        anchor: { leftLineNo: 2, rightLineNo: 3 },
        tracking: { leftLineNo: 4, rightLineNo: "invalid" },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 5, rightLineNo: 6 },
        tracking: { leftLineNo: -1, rightLineNo: 1.5 },
        reason: "edit-unresolved",
      },
    ] as unknown as NonNullable<PersistedState["staleAnchors"]>;
    storage.setItem(STORAGE_KEY, JSON.stringify(malformed));

    const restored = await loadPersistedState(storage);

    expect(restored?.staleAnchors).toEqual([
      {
        anchor: { leftLineNo: 2, rightLineNo: 3 },
        tracking: { leftLineNo: 4, rightLineNo: null },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 5, rightLineNo: 6 },
        reason: "edit-unresolved",
      },
    ]);
  });

  it("keeps cleared pane content after save", async () => {
    const storage = createStorage();
    let state = createState();
    await savePersistedState(storage, state);

    state = createState({ leftText: "", rightText: "right content" });
    const scheduler = createPersistScheduler({
      storage,
      getState: () => state,
      delayMs: 10,
    });
    scheduler.schedule();
    await vi.runAllTimersAsync();

    const restored = await loadPersistedState(storage, { key: STORAGE_KEY });
    expect(restored?.leftText).toBe("");
    expect(restored?.rightText).toBe("right content");
  });

  it("migrates inline text into the text store when available", async () => {
    const storage = createStorage();
    const textStore = createTextStore();
    const state = createState({ leftText: "legacy left", rightText: "legacy right" });

    await savePersistedState(storage, state);

    const restored = await loadPersistedState(storage, { key: STORAGE_KEY, textStore });
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");

    expect(restored?.leftText).toBe("legacy left");
    expect(restored?.rightText).toBe("legacy right");
    expect(raw.leftText).toBe("legacy left");
    expect(raw.rightText).toBe("legacy right");
    expect(raw.textStorage).toBe("indexeddb");
    expect(textStore.texts.size).toBe(2);
  });

  it("restores small text from localStorage fallback when IndexedDB text is missing", async () => {
    const storage = createStorage();
    const textStore = createTextStore();

    await savePersistedState(
      storage,
      createState({ leftText: "left fallback", rightText: "right fallback" }),
      { key: STORAGE_KEY, textStore },
    );
    textStore.texts.clear();

    const restored = await loadPersistedState(storage, {
      key: STORAGE_KEY,
      textStore,
    });

    expect(restored?.leftText).toBe("left fallback");
    expect(restored?.rightText).toBe("right fallback");
    expect(
      getDiffBlockStarts(
        pairReplace(diffLines(restored?.leftText ?? "", restored?.rightText ?? "")),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("does not keep large text inline in localStorage fallback", async () => {
    const storage = createStorage();
    const textStore = createTextStore();
    const largeText = "line\n".repeat(60000);

    await savePersistedState(
      storage,
      createState({ leftText: largeText, rightText: largeText }),
      { key: STORAGE_KEY, textStore },
    );

    const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");

    expect(raw.leftText).toBe("");
    expect(raw.rightText).toBe("");
    expect(raw.textStorage).toBe("indexeddb");
    expect(textStore.texts.get(`${STORAGE_KEY}:text:left`)).toBe(largeText);
    expect(textStore.texts.get(`${STORAGE_KEY}:text:right`)).toBe(largeText);
  });

  it("writes a full inline emergency snapshot so the latest text can be restored after pagehide", async () => {
    const storage = createStorage();
    const textStore = createTextStore();
    const largeText = "line\n".repeat(60000);

    await savePersistedState(
      storage,
      createState({ leftText: largeText, rightText: "right fallback" }),
      { key: STORAGE_KEY, textStore },
    );
    textStore.texts.clear();

    saveInlinePersistedStateSnapshot(
      storage,
      createState({ leftText: largeText, rightText: "right fallback" }),
      { key: STORAGE_KEY },
    );

    const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
    const restored = await loadPersistedState(storage, {
      key: STORAGE_KEY,
      textStore,
    });

    expect(raw.textStorage).toBe("inline");
    expect(raw.leftText).toBe(largeText);
    expect(raw.rightText).toBe("right fallback");
    expect(restored?.leftText).toBe(largeText);
    expect(restored?.rightText).toBe("right fallback");
  });

  it("prefers inline text over stale text-store data after fallback persistence", async () => {
    const storage = createStorage();
    const staleTextStore = createTextStore();
    const fallbackTextStore: TextStore = {
      isAvailable: true,
      get: staleTextStore.get,
      set: async () => {
        throw new Error("idb write failed");
      },
      delete: staleTextStore.delete,
    };

    staleTextStore.texts.set(`${STORAGE_KEY}:text:left`, "stale left");
    staleTextStore.texts.set(`${STORAGE_KEY}:text:right`, "stale right");

    await savePersistedState(
      storage,
      createState({ leftText: "fresh left", rightText: "fresh right" }),
      { key: STORAGE_KEY, textStore: fallbackTextStore },
    );

    const restored = await loadPersistedState(storage, {
      key: STORAGE_KEY,
      textStore: staleTextStore,
    });

    expect(restored?.leftText).toBe("fresh left");
    expect(restored?.rightText).toBe("fresh right");
  });
});
