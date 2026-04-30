import { diffWithAnchors, type Anchor } from "./anchors";
import { diffLines, type DiffLinesOptions } from "./diffLines";
import {
  EMBEDDED_DIFF_WASM_BUILD_ID,
  EMBEDDED_DIFF_WASM_BYTES,
  EMBEDDED_DIFF_WASM_STATUS,
} from "./embeddedDiffWasm";
import type { LineOp, PairedOp } from "./types";

export type { DiffLinesOptions } from "./diffLines";

export type DiffEngineMode = "auto" | "ts" | "wasm";
export type ActiveDiffEngineMode = "ts" | "wasm";

export type DiffEngineBindings = {
  buildId?: string | null;
  diffLines: (
    leftText: string,
    rightText: string,
    options?: DiffLinesOptions,
  ) => LineOp[];
  diffWithAnchors: (
    leftText: string,
    rightText: string,
    anchors: Anchor[],
    options?: DiffLinesOptions,
  ) => PairedOp[];
};

export type DiffEngineStatus = {
  activeMode: ActiveDiffEngineMode;
  attemptedWasm: boolean;
  fallbackReason: string | null;
  initializationMs: number | null;
  requestedMode: DiffEngineMode;
  wasmBuildId: string | null;
};

export type DiffEngine = DiffEngineBindings & {
  getStatus: () => DiffEngineStatus;
};

type CreateDiffEngineOptions = {
  loadWasmDiffEngine?: () => Promise<DiffEngineBindings>;
  mode?: DiffEngineMode;
  now?: () => number;
};

const DIFF_ENGINE_WASM_ABI_VERSION = 1;

function createTypeScriptBindings(): DiffEngineBindings {
  return {
    buildId: null,
    diffLines,
    diffWithAnchors,
  };
}

function cloneStatus(status: DiffEngineStatus): DiffEngineStatus {
  return { ...status };
}

function wrapBindings(
  bindings: DiffEngineBindings,
  status: DiffEngineStatus,
): DiffEngine {
  return {
    buildId: bindings.buildId ?? null,
    diffLines: (leftText, rightText, options) =>
      bindings.diffLines(leftText, rightText, options),
    diffWithAnchors: (leftText, rightText, anchors, options) =>
      bindings.diffWithAnchors(leftText, rightText, anchors, options),
    getStatus: () => cloneStatus(status),
  };
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
}

function defaultNow(): number {
  return performance.now();
}

export function isDiffEngineMode(value: string | null | undefined): value is DiffEngineMode {
  return value === "auto" || value === "ts" || value === "wasm";
}

export async function loadEmbeddedWasmDiffEngine(): Promise<DiffEngineBindings> {
  if (EMBEDDED_DIFF_WASM_STATUS === "not_generated") {
    throw new Error("embedded wasm is not generated");
  }
  if (EMBEDDED_DIFF_WASM_STATUS === "missing_target") {
    throw new Error("wasm32 target is not installed");
  }
  if (EMBEDDED_DIFF_WASM_STATUS === "build_failed") {
    throw new Error("embedded wasm build failed");
  }
  if (EMBEDDED_DIFF_WASM_STATUS === "missing_manifest") {
    throw new Error("embedded wasm manifest is missing");
  }
  if (EMBEDDED_DIFF_WASM_STATUS === "metadata_only") {
    throw new Error("embedded wasm diff bridge is not implemented");
  }
  if (EMBEDDED_DIFF_WASM_BYTES.length === 0) {
    throw new Error("embedded wasm is unavailable");
  }
  const module = await WebAssembly.compile(EMBEDDED_DIFF_WASM_BYTES);
  const instance = await WebAssembly.instantiate(module, {});
  const exports = instance.exports as WebAssembly.Exports & {
    diff_engine_abi_version?: () => number;
  };
  if (typeof exports.diff_engine_abi_version !== "function") {
    throw new Error("embedded wasm abi export is missing");
  }
  if (exports.diff_engine_abi_version() !== DIFF_ENGINE_WASM_ABI_VERSION) {
    throw new Error("embedded wasm abi version is unsupported");
  }
  void EMBEDDED_DIFF_WASM_BUILD_ID;
  throw new Error("embedded wasm bridge is not implemented");
}

export async function createDiffEngine(
  options: CreateDiffEngineOptions = {},
): Promise<DiffEngine> {
  const mode = options.mode ?? "auto";
  const tsBindings = createTypeScriptBindings();

  if (mode === "ts") {
    return wrapBindings(tsBindings, {
      activeMode: "ts",
      attemptedWasm: false,
      fallbackReason: null,
      initializationMs: null,
      requestedMode: mode,
      wasmBuildId: null,
    });
  }

  const loadWasmDiffEngine = options.loadWasmDiffEngine ?? loadEmbeddedWasmDiffEngine;
  const now = options.now ?? defaultNow;
  const startedAt = now();

  try {
    const wasmBindings = await loadWasmDiffEngine();
    const endedAt = now();
    return wrapBindings(wasmBindings, {
      activeMode: "wasm",
      attemptedWasm: true,
      fallbackReason: null,
      initializationMs: endedAt - startedAt,
      requestedMode: mode,
      wasmBuildId: wasmBindings.buildId ?? null,
    });
  } catch (error) {
    const endedAt = now();
    return wrapBindings(tsBindings, {
      activeMode: "ts",
      attemptedWasm: true,
      fallbackReason: resolveErrorMessage(error),
      initializationMs: endedAt - startedAt,
      requestedMode: mode,
      wasmBuildId: null,
    });
  }
}
