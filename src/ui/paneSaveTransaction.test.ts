import { describe, expect, it, vi } from "vitest";
import {
  advancePaneOperationGeneration,
  capturePaneOperationGeneration,
  createPaneOperationGenerations,
  isPaneOperationGenerationCurrent,
} from "./paneOperationGeneration";
import { runPaneSaveTransaction } from "./paneSaveTransaction";

type Target = { name: string };
type SourceFile = { name: string; text: string };
type WriteItem = { target: Target; text: string };

describe("runPaneSaveTransaction", () => {
  it("writes nothing when workspace changes while mismatched raw files are reloaded", async () => {
    let currentWorkspace = "workspace-a";
    let finishGetFile: ((file: SourceFile) => void) | undefined;
    const write = vi.fn(async () => undefined);

    const transaction = runPaneSaveTransaction({
      targets: [{ name: "old-target.txt" }],
      cachedSourceFiles: [{ name: "different-cache.txt", text: "cached" }],
      getTargetName: (target) => target.name,
      getSourceFileName: (file) => file.name,
      loadSourceFile: () =>
        new Promise<SourceFile>((resolve) => {
          finishGetFile = resolve;
        }),
      buildWriteItems: (sourceFiles, targets) => [
        { target: targets[0], text: sourceFiles[0].text },
      ],
      requestPermission: async () => true,
      commitGuard: {
        expectedContext: "workspace-a",
        isCurrent: (expected) => currentWorkspace === expected,
      },
      write,
    });

    await vi.waitFor(() => expect(finishGetFile).toBeTypeOf("function"));
    currentWorkspace = "workspace-b";
    finishGetFile?.({ name: "old-target.txt", text: "loaded old source" });

    await expect(transaction).resolves.toEqual({
      status: "context-changed",
      expectedContext: "workspace-a",
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("continues when only the other pane generation changes", async () => {
    let generations = createPaneOperationGenerations();
    const leftToken = capturePaneOperationGeneration(generations, "left");
    const write = vi.fn(async () => undefined);

    const transaction = runPaneSaveTransaction({
      targets: [{ name: "left.txt" }],
      cachedSourceFiles: [],
      getTargetName: (target) => target.name,
      getSourceFileName: (file: SourceFile) => file.name,
      loadSourceFile: async () => {
        generations = advancePaneOperationGeneration(generations, "right");
        return { name: "left.txt", text: "left snapshot" };
      },
      buildWriteItems: (sourceFiles, targets): WriteItem[] => [
        { target: targets[0], text: sourceFiles[0].text },
      ],
      requestPermission: async () => true,
      commitGuard: {
        expectedContext: leftToken,
        isCurrent: (expected) =>
          isPaneOperationGenerationCurrent(generations, expected),
      },
      write,
    });

    await expect(transaction).resolves.toMatchObject({ status: "committed" });
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(
      { target: { name: "left.txt" }, text: "left snapshot" },
      0,
    );
  });

  it("prepares and permits every target before writing the snapshot plan", async () => {
    const events: string[] = [];
    let liveText = "snapshot";

    const result = await runPaneSaveTransaction({
      targets: [{ name: "a.txt" }, { name: "b.txt" }],
      cachedSourceFiles: [
        { name: "a.txt", text: "source-a" },
        { name: "b.txt", text: "source-b" },
      ],
      getTargetName: (target) => target.name,
      getSourceFileName: (file) => file.name,
      loadSourceFile: async () => {
        throw new Error("matching cache must be used");
      },
      buildWriteItems: (_sourceFiles, targets) => {
        const snapshotText = liveText;
        events.push("build");
        return targets.map((target) => ({ target, text: snapshotText }));
      },
      requestPermission: async (target) => {
        events.push(`permission:${target.name}`);
        return true;
      },
      commitGuard: {
        expectedContext: "current",
        isCurrent: () => {
          events.push("guard");
          return true;
        },
      },
      write: async (item) => {
        events.push(`write:${item.target.name}:${item.text}`);
        liveText = "changed after writing started";
      },
    });

    expect(result).toMatchObject({ status: "committed" });
    expect(events).toEqual([
      "build",
      "permission:a.txt",
      "permission:b.txt",
      "guard",
      "write:a.txt:snapshot",
      "write:b.txt:snapshot",
    ]);
  });
});
