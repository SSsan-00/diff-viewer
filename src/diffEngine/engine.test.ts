import { afterEach, describe, expect, it, vi } from "vitest";
import { diffLines } from "./diffLines";
import {
  diffInline,
  diffInlineWithAppendLiteralBatch,
  setDiffInlineBatchCore,
  setDiffInlineCore,
} from "./diffInline";
import { diffWithAnchors, type Anchor } from "./anchors";
import {
  EMBEDDED_DIFF_WASM_BUILD_ID,
  EMBEDDED_DIFF_WASM_STATUS,
} from "./embeddedDiffWasm";
import type { DiffLinesOptions, DiffEngineBindings, DiffEngineMode } from "./engine";
import { createDiffEngine, loadEmbeddedWasmDiffEngine } from "./engine";
import type { LineOp, PairedOp } from "./types";

afterEach(() => {
  setDiffInlineCore(null);
  setDiffInlineBatchCore(null);
});

function createNow(values: number[]) {
  let index = 0;
  return vi.fn(() => {
    const resolved = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return resolved;
  });
}

describe("createDiffEngine", () => {
  it("loads the embedded wasm diff engine", async () => {
    expect(EMBEDDED_DIFF_WASM_STATUS).toBe("ready");

    const bindings = await loadEmbeddedWasmDiffEngine();

    expect(bindings.buildId).toBe(EMBEDDED_DIFF_WASM_BUILD_ID);
  });

  it("keeps embedded wasm diff output aligned with the TypeScript implementation", async () => {
    const bindings = await loadEmbeddedWasmDiffEngine();
    const cases: Array<{
      left: string;
      options?: DiffLinesOptions;
      right: string;
    }> = [
      { left: "a\nb", right: "a\nb" },
      { left: "a", right: "a\nb" },
      { left: "a\nx\nb", right: "a\ny\nb" },
      {
        left: "  <head>\n<body>",
        options: { ignoreLeadingFileWhitespace: true },
        right: "<head>\n<body>",
      },
      {
        left: Array.from({ length: 60 }, (_, index) => `left-${index % 7}`).join("\n"),
        right: Array.from({ length: 65 }, (_, index) => `left-${(index + 2) % 7}`).join("\n"),
      },
    ];

    for (const testCase of cases) {
      expect(
        bindings.diffLines(testCase.left, testCase.right, testCase.options),
      ).toEqual(diffLines(testCase.left, testCase.right, testCase.options));
    }
  });

  it("keeps embedded wasm inline diff output aligned with the TypeScript implementation", async () => {
    const left = '    <div class="a  b" id="x"></div>';
    const right = '<div class="a b" id="x"></div>';
    const baseline = diffInline(left, right);

    const engine = await createDiffEngine({
      mode: "wasm",
      loadWasmDiffEngine: loadEmbeddedWasmDiffEngine,
    });

    expect(engine.getStatus().activeMode).toBe("wasm");
    expect(diffInline(left, right)).toEqual(baseline);
  });

  it("keeps embedded wasm append-literal batch diff output aligned with the TypeScript implementation", async () => {
    const inputs = [
      {
        leftLine: "<head>",
        rightLine: "sb.AppendLine(\"<headx>\");",
      },
      {
        leftLine: "    value = 1;",
        rightLine: "value = 1;",
        options: {
          ignoreLeadingFileWhitespace: true,
          leftLeadingFileWhitespaceEligible: true,
          rightLeadingFileWhitespaceEligible: true,
        },
      },
    ] as const;
    const baseline = diffInlineWithAppendLiteralBatch(inputs);

    const engine = await createDiffEngine({
      mode: "wasm",
      loadWasmDiffEngine: loadEmbeddedWasmDiffEngine,
    });

    expect(engine.getStatus().activeMode).toBe("wasm");
    expect(diffInlineWithAppendLiteralBatch(inputs)).toEqual(baseline);
  });

  it("keeps anchor-aware diff output aligned when wasm is active", async () => {
    const bindings = await loadEmbeddedWasmDiffEngine();
    const anchors: Anchor[] = [{ leftLineNo: 2, rightLineNo: 3 }];
    const left = "head\nalpha\nbeta\ngamma";
    const right = "head\ninserted\nalpha\ndelta\ngamma";

    expect(bindings.diffWithAnchors(left, right, anchors)).toEqual(
      diffWithAnchors(left, right, anchors),
    );
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
    const activateRuntimeFeatures = vi.fn();
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
        activateRuntimeFeatures,
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
    expect(activateRuntimeFeatures).toHaveBeenCalledOnce();
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
