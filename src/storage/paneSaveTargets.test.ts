import { describe, expect, it } from "vitest";
import {
  clearPaneSaveTarget,
  loadPaneSaveTarget,
  loadPaneSaveTargets,
  savePaneSaveTarget,
  savePaneSaveTargets,
  type PaneSaveTargetStore,
} from "./paneSaveTargets";
import type { PaneSaveTarget } from "../file/writeback";

function createMemoryStore(): PaneSaveTargetStore & {
  values: Map<string, PaneSaveTarget | PaneSaveTarget[]>;
} {
  const values = new Map<string, PaneSaveTarget | PaneSaveTarget[]>();
  return {
    isAvailable: true,
    values,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
  };
}

function createTarget(fileName: string): PaneSaveTarget {
  return {
    handle: {
      name: fileName,
      async getFile() {
        return new File(["a"], fileName);
      },
    },
    fileName,
    resolvedEncoding: "utf-8",
    includeUtf8Bom: false,
    lineEnding: "\n",
  };
}

describe("pane save target storage", () => {
  it("stores and restores a save target per workspace pane", async () => {
    const store = createMemoryStore();
    const left = createTarget("left.txt");
    const right = createTarget("right.txt");

    await savePaneSaveTarget(store, "workspace-a", "left", left);
    await savePaneSaveTarget(store, "workspace-a", "right", right);

    expect(await loadPaneSaveTarget(store, "workspace-a", "left")).toEqual(left);
    expect(await loadPaneSaveTarget(store, "workspace-a", "right")).toEqual(right);
    expect(await loadPaneSaveTarget(store, "workspace-b", "left")).toBeNull();
  });

  it("clears only the requested workspace pane target", async () => {
    const store = createMemoryStore();
    const left = createTarget("left.txt");
    const right = createTarget("right.txt");

    await savePaneSaveTarget(store, "workspace-a", "left", left);
    await savePaneSaveTarget(store, "workspace-a", "right", right);
    await clearPaneSaveTarget(store, "workspace-a", "left");

    expect(await loadPaneSaveTarget(store, "workspace-a", "left")).toBeNull();
    expect(await loadPaneSaveTarget(store, "workspace-a", "right")).toEqual(right);
  });

  it("stores and restores multiple pane targets in order", async () => {
    const store = createMemoryStore();
    const first = createTarget("first.txt");
    const second = createTarget("second.txt");

    await savePaneSaveTargets(store, "workspace-a", "left", [first, second]);

    expect(await loadPaneSaveTargets(store, "workspace-a", "left")).toEqual([
      first,
      second,
    ]);
    expect(await loadPaneSaveTarget(store, "workspace-a", "left")).toEqual(first);
  });
});
