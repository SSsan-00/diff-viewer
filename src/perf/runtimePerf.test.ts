import { describe, expect, it } from "vitest";
import type { DiffEngineMode, DiffEngineStatus } from "../diffEngine/engine";
import { createDiffViewerPerfMonitor } from "./runtimePerf";

describe("createDiffViewerPerfMonitor", () => {
  it("returns the current engine status and last recalc snapshot", () => {
    const engineStatus: DiffEngineStatus = {
      activeMode: "ts",
      attemptedWasm: true,
      fallbackReason: "embedded wasm is unavailable",
      initializationMs: 7,
      requestedMode: "auto",
      wasmBuildId: null,
    };
    const monitor = createDiffViewerPerfMonitor(() => engineStatus);

    expect(monitor.getSnapshot()).toEqual({
      engine: engineStatus,
      generation: 0,
      lastRecalc: null,
    });

    monitor.recordRecalc({
      diffBlockCount: 4,
      pairedOpCount: 12,
      phases: {
        anchorValidationMs: 1.5,
        deriveMs: 3.5,
        diffComputeMs: 7.5,
        normalizeMs: 2.25,
        renderMs: 5.75,
      },
      totalMs: 20.5,
      usedCachedDerived: false,
    });

    expect(monitor.getSnapshot()).toEqual({
      engine: engineStatus,
      generation: 1,
      lastRecalc: {
        diffBlockCount: 4,
        pairedOpCount: 12,
        phases: {
          anchorValidationMs: 1.5,
          deriveMs: 3.5,
          diffComputeMs: 7.5,
          normalizeMs: 2.25,
          renderMs: 5.75,
        },
        totalMs: 20.5,
        usedCachedDerived: false,
      },
    });
  });

  it("can clear the last recorded recalc snapshot", () => {
    const monitor = createDiffViewerPerfMonitor(() => ({
      activeMode: "wasm",
      attemptedWasm: true,
      fallbackReason: null,
      initializationMs: 3,
      requestedMode: "wasm" satisfies DiffEngineMode,
      wasmBuildId: "build-1",
    }));

    monitor.recordRecalc({
      diffBlockCount: 1,
      pairedOpCount: 2,
      phases: {
        anchorValidationMs: 0.1,
        deriveMs: 0.3,
        diffComputeMs: 0.5,
        normalizeMs: 0.2,
        renderMs: 0.4,
      },
      totalMs: 1.5,
      usedCachedDerived: true,
    });
    monitor.clearLastRecalc();

    expect(monitor.getSnapshot().lastRecalc).toBeNull();
    expect(monitor.getSnapshot().generation).toBe(1);
  });

  it("exposes an explicit recalc trigger without pretending a missing UI control succeeded", () => {
    let triggerCount = 0;
    const monitor = createDiffViewerPerfMonitor(
      () => ({
        activeMode: "ts",
        attemptedWasm: false,
        fallbackReason: null,
        initializationMs: 0,
        requestedMode: "ts",
        wasmBuildId: null,
      }),
      () => {
        triggerCount += 1;
      },
    );

    expect(monitor.requestRecalc()).toBe(0);
    expect(triggerCount).toBe(1);
  });
});
