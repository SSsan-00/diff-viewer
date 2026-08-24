import { describe, expect, it, vi } from "vitest";
import { runPaneReloadTransaction } from "./paneReloadTransaction";

describe("runPaneReloadTransaction", () => {
  it("does not load or commit when read permission is denied", async () => {
    const state = { text: "before", anchors: [2] };
    const load = vi.fn(async () => "after");
    const commit = vi.fn((value: string) => {
      state.text = value;
      state.anchors = [3];
    });

    const result = await runPaneReloadTransaction({
      targets: ["a.txt", "b.txt"],
      requestPermission: async (target) => target !== "b.txt",
      load,
      prepare: (loaded) => loaded.join("\n"),
      commit,
    });

    expect(result).toEqual({ status: "permission-denied", target: "b.txt" });
    expect(load).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(state).toEqual({ text: "before", anchors: [2] });
  });

  it("does not commit when reading or preparation fails", async () => {
    const state = { text: "before", anchors: [2] };
    const commit = vi.fn();

    await expect(
      runPaneReloadTransaction({
        targets: ["a.txt"],
        requestPermission: async () => true,
        load: async () => {
          throw new Error("read failed");
        },
        prepare: (loaded) => loaded,
        commit,
      }),
    ).rejects.toThrow("read failed");
    expect(commit).not.toHaveBeenCalled();
    expect(state).toEqual({ text: "before", anchors: [2] });

    await expect(
      runPaneReloadTransaction({
        targets: ["a.txt"],
        requestPermission: async () => true,
        load: async () => "loaded",
        prepare: () => {
          throw new Error("decode failed");
        },
        commit,
      }),
    ).rejects.toThrow("decode failed");
    expect(commit).not.toHaveBeenCalled();
  });

  it("does not commit when the reload generation changes while loading", async () => {
    const state = { text: "before", anchors: [2] };
    const commit = vi.fn((value: string) => {
      state.text = value;
      state.anchors = [3];
    });
    let finishLoad: ((value: string) => void) | undefined;
    let currentGeneration = 7;

    const transaction = runPaneReloadTransaction({
      targets: ["a.txt"],
      requestPermission: async () => true,
      load: () =>
        new Promise<string>((resolve) => {
          finishLoad = resolve;
        }),
      prepare: (loaded) => loaded[0],
      commit,
      commitGuard: {
        expectedContext: 7,
        isCurrent: (expectedGeneration) =>
          currentGeneration === expectedGeneration,
      },
    });

    await vi.waitFor(() => expect(finishLoad).toBeTypeOf("function"));
    currentGeneration = 8;
    finishLoad?.("after");

    await expect(transaction).resolves.toEqual({
      status: "context-changed",
      expectedContext: 7,
    });
    expect(commit).not.toHaveBeenCalled();
    expect(state).toEqual({ text: "before", anchors: [2] });
  });

  it("does not commit when the expected pane context changes while preparing", async () => {
    type ReloadContext = {
      generation: number;
      workspaceId: string;
      pane: "left" | "right";
      targetId: string;
      encoding: string;
    };
    const expectedContext: ReloadContext = {
      generation: 3,
      workspaceId: "workspace-a",
      pane: "left",
      targetId: "a.txt",
      encoding: "UTF-8",
    };
    let currentContext = { ...expectedContext };
    let finishPrepare: ((value: string) => void) | undefined;
    const commit = vi.fn();

    const transaction = runPaneReloadTransaction({
      targets: ["a.txt"],
      requestPermission: async () => true,
      load: async () => "loaded",
      prepare: () =>
        new Promise<string>((resolve) => {
          finishPrepare = resolve;
        }),
      commit,
      commitGuard: {
        expectedContext,
        isCurrent: (expected) =>
          expected.generation === currentContext.generation &&
          expected.workspaceId === currentContext.workspaceId &&
          expected.pane === currentContext.pane &&
          expected.targetId === currentContext.targetId &&
          expected.encoding === currentContext.encoding,
      },
    });

    await vi.waitFor(() => expect(finishPrepare).toBeTypeOf("function"));
    currentContext = { ...currentContext, encoding: "Shift_JIS" };
    finishPrepare?.("prepared");

    await expect(transaction).resolves.toEqual({
      status: "context-changed",
      expectedContext,
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("commits once after every target was loaded and prepared", async () => {
    const commit = vi.fn();
    const isCurrent = vi.fn(() => true);

    const result = await runPaneReloadTransaction({
      targets: ["a.txt", "b.txt"],
      requestPermission: async () => true,
      load: async (target) => `${target}:loaded`,
      prepare: (loaded) => loaded.join("|"),
      commit,
      commitGuard: {
        expectedContext: { generation: 1, pane: "left" },
        isCurrent,
      },
    });

    expect(result).toEqual({
      status: "committed",
      prepared: "a.txt:loaded|b.txt:loaded",
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith("a.txt:loaded|b.txt:loaded");
    expect(isCurrent).toHaveBeenCalledOnce();
    expect(isCurrent).toHaveBeenCalledWith({ generation: 1, pane: "left" });
  });
});
