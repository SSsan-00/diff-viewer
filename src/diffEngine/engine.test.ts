import { describe, expect, it, vi } from "vitest";
import { diffLines } from "./diffLines";
import { diffWithAnchors, type Anchor } from "./anchors";
import { EMBEDDED_DIFF_WASM_STATUS } from "./embeddedDiffWasm";
import type { DiffLinesOptions, DiffEngineBindings, DiffEngineMode } from "./engine";
import { createDiffEngine, loadEmbeddedWasmDiffEngine } from "./engine";
import type { LineOp, PairedOp } from "./types";

function createNow(values: number[]) {
  let index = 0;
  return vi.fn(() => {
    const resolved = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return resolved;
  });
}

describe("createDiffEngine", () => {
  it("reports the current embedded wasm availability state", async () => {
    const expectedMessage = {
      build_failed: "embedded wasm build failed",
      metadata_only: "embedded wasm diff bridge is not implemented",
      missing_manifest: "embedded wasm manifest is missing",
      missing_target: "wasm32 target is not installed",
      not_generated: "embedded wasm is not generated",
      ready: "embedded wasm bridge is not implemented",
    }[EMBEDDED_DIFF_WASM_STATUS];

    await expect(loadEmbeddedWasmDiffEngine()).rejects.toThrow(expectedMessage);
  });

  it("keeps the TypeScript engine as the default implementation", async () => {
    const loadWasmDiffEngine = vi.fn<() => Promise<DiffEngineBindings>>();
    const engine = await createDiffEngine({
      mode: "ts",
      loadWasmDiffEngine,
    });

    expect(loadWasmDiffEngine).not.toHaveBeenCalled();
    expect(engine.getStatus()).toEqual({
      activeMode: "ts",
      attemptedWasm: false,
      fallbackReason: null,
      initializationMs: null,
      requestedMode: "ts",
      wasmBuildId: null,
    });
    expect(engine.diffLines("a\nb", "a\nb")).toEqual(diffLines("a\nb", "a\nb"));
  });

  it("falls back to the TypeScript engine when auto mode cannot initialize wasm", async () => {
    const loadWasmDiffEngine = vi.fn<() => Promise<DiffEngineBindings>>().mockRejectedValue(
      new Error("embedded wasm is unavailable"),
    );
    const now = createNow([10, 16]);
    const left = "alpha\nbeta";
    const right = "alpha\ngamma";
    const anchors: Anchor[] = [{ leftLineNo: 1, rightLineNo: 1 }];

    const engine = await createDiffEngine({
      mode: "auto",
      loadWasmDiffEngine,
      now,
    });

    expect(loadWasmDiffEngine).toHaveBeenCalledOnce();
    expect(engine.getStatus()).toEqual({
      activeMode: "ts",
      attemptedWasm: true,
      fallbackReason: "embedded wasm is unavailable",
      initializationMs: 6,
      requestedMode: "auto",
      wasmBuildId: null,
    });
    expect(engine.diffLines(left, right)).toEqual(diffLines(left, right));
    expect(engine.diffWithAnchors(left, right, anchors)).toEqual(
      diffWithAnchors(left, right, anchors),
    );
  });

  it("uses the wasm engine when initialization succeeds", async () => {
    const diffLinesOptions: DiffLinesOptions = {
      ignoreLeadingFileWhitespace: true,
    };
    const diffLinesResult: LineOp[] = [
      {
        type: "insert",
        rightLine: "right only",
        rightLineNo: 0,
      },
    ];
    const diffWithAnchorsResult: PairedOp[] = [
      {
        type: "replace",
        leftLine: "left",
        rightLine: "right",
        leftLineNo: 0,
        rightLineNo: 0,
      },
    ];
    const diffLinesMock = vi.fn(
      (_leftText: string, _rightText: string, _options?: DiffLinesOptions) => diffLinesResult,
    );
    const diffWithAnchorsMock = vi.fn(
      (
        _leftText: string,
        _rightText: string,
        _anchors: Anchor[],
        _options?: DiffLinesOptions,
      ) => diffWithAnchorsResult,
    );
    const loadWasmDiffEngine = vi
      .fn<() => Promise<DiffEngineBindings>>()
      .mockResolvedValue({
        buildId: "test-wasm-build",
        diffLines: diffLinesMock,
        diffWithAnchors: diffWithAnchorsMock,
      });
    const now = createNow([4, 9]);
    const anchors: Anchor[] = [{ leftLineNo: 0, rightLineNo: 0 }];

    const engine = await createDiffEngine({
      mode: "wasm",
      loadWasmDiffEngine,
      now,
    });

    expect(engine.getStatus()).toEqual({
      activeMode: "wasm",
      attemptedWasm: true,
      fallbackReason: null,
      initializationMs: 5,
      requestedMode: "wasm",
      wasmBuildId: "test-wasm-build",
    });
    expect(engine.diffLines("left", "right", diffLinesOptions)).toBe(diffLinesResult);
    expect(diffLinesMock).toHaveBeenCalledWith("left", "right", diffLinesOptions);
    expect(engine.diffWithAnchors("left", "right", anchors, diffLinesOptions)).toBe(
      diffWithAnchorsResult,
    );
    expect(diffWithAnchorsMock).toHaveBeenCalledWith(
      "left",
      "right",
      anchors,
      diffLinesOptions,
    );
  });

  it("keeps standalone usage available even when explicit wasm mode fails", async () => {
    const loadWasmDiffEngine = vi.fn<() => Promise<DiffEngineBindings>>().mockRejectedValue(
      new Error("wasm initialization failed"),
    );

    const engine = await createDiffEngine({
      mode: "wasm",
      loadWasmDiffEngine,
      now: createNow([3, 11]),
    });

    expect(engine.getStatus()).toEqual({
      activeMode: "ts",
      attemptedWasm: true,
      fallbackReason: "wasm initialization failed",
      initializationMs: 8,
      requestedMode: "wasm",
      wasmBuildId: null,
    });
    expect(engine.diffLines("same", "same")).toEqual(diffLines("same", "same"));
  });
});
