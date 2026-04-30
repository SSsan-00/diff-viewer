import { createDiffWithAnchors, diffWithAnchors, type Anchor } from "./anchors";
import {
  buildLineOpsFromDiffSteps,
  diffLines,
  prepareDiffLinesInput,
  prepareDiffLinesInputFromLines,
  type DiffLinesOptions,
  type DiffStep,
} from "./diffLines";
import { setDiffInlineCore } from "./diffInline";
import {
  EMBEDDED_DIFF_WASM_BUILD_ID,
  EMBEDDED_DIFF_WASM_BYTES,
  EMBEDDED_DIFF_WASM_STATUS,
} from "./embeddedDiffWasm";
import type { InlineDiff, LineOp, PairedOp, Range } from "./types";

export type { DiffLinesOptions } from "./diffLines";

export type DiffEngineMode = "auto" | "ts" | "wasm";
export type ActiveDiffEngineMode = "ts" | "wasm";

export type DiffEngineBindings = {
  activateRuntimeFeatures?: () => void;
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
const DIFF_ENGINE_WASM_INPUT_VERSION = 1;
const DIFF_ENGINE_WASM_OUTPUT_VERSION = 1;
const INLINE_DIFF_WASM_INPUT_VERSION = 1;
const INLINE_DIFF_WASM_OUTPUT_VERSION = 1;
const DIFF_STEP_DELETE = 0;
const DIFF_STEP_INSERT = 1;
const DIFF_STEP_EQUAL = 2;
const DIFF_STEP_NONE = 0xffff_ffff;

type EmbeddedWasmExports = WebAssembly.Exports & {
  diff_engine_abi_version: () => number;
  diff_engine_alloc: (len: number) => number;
  diff_engine_build_id_len: () => number;
  diff_engine_build_id_ptr: () => number;
  diff_engine_dealloc: (ptr: number, len: number) => void;
  diff_engine_diff_steps: (ptr: number, len: number) => number;
  diff_engine_inline_diff: (ptr: number, len: number) => number;
  diff_engine_take_error_len: () => number;
  diff_engine_take_error_ptr: () => number;
  diff_engine_take_result_len: () => number;
  diff_engine_take_result_ptr: () => number;
  memory: WebAssembly.Memory;
};

function createTypeScriptBindings(): DiffEngineBindings {
  return {
    activateRuntimeFeatures: () => {
      setDiffInlineCore(null);
    },
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
  bindings.activateRuntimeFeatures?.();
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

function requireFunctionExport<T extends (...args: number[]) => number | void>(
  exports: WebAssembly.Exports,
  name: string,
): T {
  const value = exports[name];
  if (typeof value !== "function") {
    throw new Error(`embedded wasm export is missing: ${name}`);
  }
  return value as T;
}

function requireMemoryExport(exports: WebAssembly.Exports): WebAssembly.Memory {
  const memory = exports.memory;
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new Error("embedded wasm memory export is missing");
  }
  return memory;
}

function createEmbeddedWasmExports(instance: WebAssembly.Instance): EmbeddedWasmExports {
  const exports = instance.exports;
  return {
    ...exports,
    diff_engine_abi_version: requireFunctionExport(exports, "diff_engine_abi_version"),
    diff_engine_alloc: requireFunctionExport(exports, "diff_engine_alloc"),
    diff_engine_build_id_len: requireFunctionExport(exports, "diff_engine_build_id_len"),
    diff_engine_build_id_ptr: requireFunctionExport(exports, "diff_engine_build_id_ptr"),
    diff_engine_dealloc: requireFunctionExport(exports, "diff_engine_dealloc"),
    diff_engine_diff_steps: requireFunctionExport(exports, "diff_engine_diff_steps"),
    diff_engine_inline_diff: requireFunctionExport(exports, "diff_engine_inline_diff"),
    diff_engine_take_error_len: requireFunctionExport(exports, "diff_engine_take_error_len"),
    diff_engine_take_error_ptr: requireFunctionExport(exports, "diff_engine_take_error_ptr"),
    diff_engine_take_result_len: requireFunctionExport(exports, "diff_engine_take_result_len"),
    diff_engine_take_result_ptr: requireFunctionExport(exports, "diff_engine_take_result_ptr"),
    memory: requireMemoryExport(exports),
  };
}

function readBytes(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): Uint8Array {
  return new Uint8Array(memory.buffer.slice(ptr, ptr + len));
}

function readUtf8(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): string {
  return new TextDecoder().decode(readBytes(memory, ptr, len));
}

function takeOwnedBytes(
  exports: EmbeddedWasmExports,
  takePtr: () => number,
  takeLen: () => number,
): Uint8Array {
  const ptr = takePtr();
  const len = takeLen();
  if (ptr === 0 || len === 0) {
    return new Uint8Array([]);
  }
  const bytes = readBytes(exports.memory, ptr, len);
  exports.diff_engine_dealloc(ptr, len);
  return bytes;
}

function takeOwnedString(
  exports: EmbeddedWasmExports,
  takePtr: () => number,
  takeLen: () => number,
): string {
  const bytes = takeOwnedBytes(exports, takePtr, takeLen);
  if (bytes.length === 0) {
    return "";
  }
  return new TextDecoder().decode(bytes);
}

function internCompareLines(
  leftCompare: string[],
  rightCompare: string[],
): { leftIds: number[]; rightIds: number[] } {
  const ids = new Map<string, number>();
  let nextId = 0;
  const resolveId = (value: string): number => {
    const existing = ids.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const resolved = nextId;
    nextId += 1;
    ids.set(value, resolved);
    return resolved;
  };
  return {
    leftIds: leftCompare.map(resolveId),
    rightIds: rightCompare.map(resolveId),
  };
}

function encodeDiffStepRequest(leftIds: number[], rightIds: number[]): Uint8Array {
  const headerWords = 3;
  const words = headerWords + leftIds.length + rightIds.length;
  const bytes = new Uint8Array(words * 4);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  const writeU32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };

  writeU32(DIFF_ENGINE_WASM_INPUT_VERSION);
  writeU32(leftIds.length);
  writeU32(rightIds.length);
  leftIds.forEach(writeU32);
  rightIds.forEach(writeU32);
  return bytes;
}

function encodeInlineDiffRequest(leftLine: string, rightLine: string): Uint8Array {
  const bytes = new Uint8Array(12 + (leftLine.length + rightLine.length) * 2);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  const writeU32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const writeU16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };

  writeU32(INLINE_DIFF_WASM_INPUT_VERSION);
  writeU32(leftLine.length);
  writeU32(rightLine.length);
  for (let index = 0; index < leftLine.length; index += 1) {
    writeU16(leftLine.charCodeAt(index));
  }
  for (let index = 0; index < rightLine.length; index += 1) {
    writeU16(rightLine.charCodeAt(index));
  }

  return bytes;
}

function parseDiffStepResponse(bytes: Uint8Array): DiffStep[] {
  if (bytes.length < 8) {
    throw new Error("embedded wasm diff response is truncated");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(0, true);
  if (version !== DIFF_ENGINE_WASM_OUTPUT_VERSION) {
    throw new Error("embedded wasm diff response version is unsupported");
  }
  const stepCount = view.getUint32(4, true);
  const expectedBytes = 8 + stepCount * 12;
  if (bytes.length !== expectedBytes) {
    throw new Error("embedded wasm diff response size is invalid");
  }
  const steps: DiffStep[] = [];
  let offset = 8;

  for (let index = 0; index < stepCount; index += 1) {
    const typeCode = view.getUint32(offset, true);
    const leftIndex = view.getUint32(offset + 4, true);
    const rightIndex = view.getUint32(offset + 8, true);
    offset += 12;

    if (typeCode === DIFF_STEP_EQUAL) {
      steps.push({
        type: "equal",
        leftIndex,
        rightIndex,
      });
      continue;
    }
    if (typeCode === DIFF_STEP_DELETE) {
      steps.push({
        type: "delete",
        leftIndex,
      });
      continue;
    }
    if (typeCode === DIFF_STEP_INSERT) {
      steps.push({
        type: "insert",
        rightIndex,
      });
      continue;
    }
    throw new Error("embedded wasm diff response contains an unknown step");
  }

  return steps.map((step) => ({
    ...step,
    leftIndex: step.leftIndex === DIFF_STEP_NONE ? undefined : step.leftIndex,
    rightIndex: step.rightIndex === DIFF_STEP_NONE ? undefined : step.rightIndex,
  }));
}

function parseRanges(
  view: DataView,
  offset: number,
  count: number,
): { nextOffset: number; ranges: Range[] } {
  const ranges: Range[] = [];
  let nextOffset = offset;

  for (let index = 0; index < count; index += 1) {
    ranges.push({
      start: view.getUint32(nextOffset, true),
      end: view.getUint32(nextOffset + 4, true),
    });
    nextOffset += 8;
  }

  return { nextOffset, ranges };
}

function parseInlineDiffResponse(bytes: Uint8Array): InlineDiff {
  if (bytes.length < 12) {
    throw new Error("embedded wasm inline response is truncated");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(0, true);
  if (version !== INLINE_DIFF_WASM_OUTPUT_VERSION) {
    throw new Error("embedded wasm inline response version is unsupported");
  }
  const leftRangeCount = view.getUint32(4, true);
  const rightRangeCount = view.getUint32(8, true);
  const expectedBytes = 12 + (leftRangeCount + rightRangeCount) * 8;
  if (bytes.length !== expectedBytes) {
    throw new Error("embedded wasm inline response size is invalid");
  }

  const left = parseRanges(view, 12, leftRangeCount);
  const right = parseRanges(view, left.nextOffset, rightRangeCount);
  return {
    leftRanges: left.ranges,
    rightRanges: right.ranges,
  };
}

function runEmbeddedWasmDiff(
  exports: EmbeddedWasmExports,
  leftCompare: string[],
  rightCompare: string[],
): DiffStep[] {
  const { leftIds, rightIds } = internCompareLines(leftCompare, rightCompare);
  const request = encodeDiffStepRequest(leftIds, rightIds);
  const ptr = exports.diff_engine_alloc(request.length);
  if (ptr === 0 && request.length > 0) {
    throw new Error("embedded wasm allocation failed");
  }

  try {
    new Uint8Array(exports.memory.buffer, ptr, request.length).set(request);
    const status = exports.diff_engine_diff_steps(ptr, request.length);
    if (status !== 0) {
      const message = takeOwnedString(
        exports,
        () => exports.diff_engine_take_error_ptr(),
        () => exports.diff_engine_take_error_len(),
      );
      throw new Error(message || "embedded wasm diff computation failed");
    }
    const response = takeOwnedBytes(
      exports,
      () => exports.diff_engine_take_result_ptr(),
      () => exports.diff_engine_take_result_len(),
    );
    return parseDiffStepResponse(response);
  } finally {
    if (ptr !== 0) {
      exports.diff_engine_dealloc(ptr, request.length);
    }
  }
}

function runEmbeddedWasmInlineDiff(
  exports: EmbeddedWasmExports,
  leftLine: string,
  rightLine: string,
): InlineDiff {
  const request = encodeInlineDiffRequest(leftLine, rightLine);
  const ptr = exports.diff_engine_alloc(request.length);
  if (ptr === 0 && request.length > 0) {
    throw new Error("embedded wasm allocation failed");
  }

  try {
    new Uint8Array(exports.memory.buffer, ptr, request.length).set(request);
    const status = exports.diff_engine_inline_diff(ptr, request.length);
    if (status !== 0) {
      const message = takeOwnedString(
        exports,
        () => exports.diff_engine_take_error_ptr(),
        () => exports.diff_engine_take_error_len(),
      );
      throw new Error(message || "embedded wasm inline computation failed");
    }
    const response = takeOwnedBytes(
      exports,
      () => exports.diff_engine_take_result_ptr(),
      () => exports.diff_engine_take_result_len(),
    );
    return parseInlineDiffResponse(response);
  } finally {
    if (ptr !== 0) {
      exports.diff_engine_dealloc(ptr, request.length);
    }
  }
}

function buildLineOpsWithEmbeddedWasm(
  exports: EmbeddedWasmExports,
  prepared: ReturnType<typeof prepareDiffLinesInput>,
): LineOp[] {
  const steps = runEmbeddedWasmDiff(exports, prepared.leftCompare, prepared.rightCompare);
  return buildLineOpsFromDiffSteps(prepared, steps);
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
  if (EMBEDDED_DIFF_WASM_BYTES.length === 0) {
    throw new Error("embedded wasm is unavailable");
  }
  const module = await WebAssembly.compile(EMBEDDED_DIFF_WASM_BYTES);
  const instance = await WebAssembly.instantiate(module, {});
  const exports = createEmbeddedWasmExports(instance);
  if (exports.diff_engine_abi_version() !== DIFF_ENGINE_WASM_ABI_VERSION) {
    throw new Error("embedded wasm abi version is unsupported");
  }
  const buildId = readUtf8(
    exports.memory,
    exports.diff_engine_build_id_ptr(),
    exports.diff_engine_build_id_len(),
  );
  if (!buildId) {
    throw new Error("embedded wasm build id is missing");
  }
  if (EMBEDDED_DIFF_WASM_BUILD_ID && buildId !== EMBEDDED_DIFF_WASM_BUILD_ID) {
    throw new Error("embedded wasm build id does not match the bundled bytes");
  }

  const diffLinesWithEmbeddedWasm = (
    leftText: string,
    rightText: string,
    options?: DiffLinesOptions,
  ): LineOp[] => {
    const prepared = prepareDiffLinesInput(leftText, rightText, options);
    return buildLineOpsWithEmbeddedWasm(exports, prepared);
  };
  const diffSegmentLinesWithEmbeddedWasm = (
    leftLines: string[],
    rightLines: string[],
    options: DiffLinesOptions,
  ): LineOp[] => {
    const prepared = prepareDiffLinesInputFromLines(leftLines, rightLines, options);
    return buildLineOpsWithEmbeddedWasm(exports, prepared);
  };
  const diffInlineWithEmbeddedWasm = (
    leftLine: string,
    rightLine: string,
  ): InlineDiff => runEmbeddedWasmInlineDiff(exports, leftLine, rightLine);

  return {
    activateRuntimeFeatures: () => {
      setDiffInlineCore(diffInlineWithEmbeddedWasm);
    },
    buildId,
    diffLines: diffLinesWithEmbeddedWasm,
    diffWithAnchors: createDiffWithAnchors(diffSegmentLinesWithEmbeddedWasm),
  };
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
