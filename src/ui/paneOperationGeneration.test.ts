import { describe, expect, it, vi } from "vitest";
import { runPaneReloadTransaction } from "./paneReloadTransaction";
import {
  advancePaneOperationGeneration,
  capturePaneOperationGeneration,
  createPaneOperationGenerations,
  invalidatePaneOperationGenerations,
  isPaneOperationGenerationCurrent,
} from "./paneOperationGeneration";

describe("pane operation generations", () => {
  it("invalidates prepared work on both panes at a forced snapshot boundary", () => {
    const initial = createPaneOperationGenerations();
    const left = capturePaneOperationGeneration(initial, "left");
    const right = capturePaneOperationGeneration(initial, "right");

    const invalidated = invalidatePaneOperationGenerations(initial);

    expect(isPaneOperationGenerationCurrent(invalidated, left)).toBe(false);
    expect(isPaneOperationGenerationCurrent(invalidated, right)).toBe(false);
  });

  it("aborts a reload after the same pane starts saving", async () => {
    let generations = createPaneOperationGenerations();
    const reloadToken = capturePaneOperationGeneration(generations, "left");
    let finishPrepare: ((value: string) => void) | undefined;
    const commit = vi.fn();

    const reload = runPaneReloadTransaction({
      targets: ["left.txt"],
      requestPermission: async () => true,
      load: async () => "external bytes read before save",
      prepare: () =>
        new Promise<string>((resolve) => {
          finishPrepare = resolve;
        }),
      commit,
      commitGuard: {
        expectedContext: reloadToken,
        isCurrent: (expected) =>
          isPaneOperationGenerationCurrent(generations, expected),
      },
    });

    await vi.waitFor(() => expect(finishPrepare).toBeTypeOf("function"));
    generations = advancePaneOperationGeneration(generations, "left");
    finishPrepare?.("stale reload result");

    await expect(reload).resolves.toEqual({
      status: "context-changed",
      expectedContext: reloadToken,
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("does not invalidate a reload when the other pane starts saving", () => {
    let generations = createPaneOperationGenerations();
    const leftReloadToken = capturePaneOperationGeneration(generations, "left");

    generations = advancePaneOperationGeneration(generations, "right");

    expect(
      isPaneOperationGenerationCurrent(generations, leftReloadToken),
    ).toBe(true);
  });
});
