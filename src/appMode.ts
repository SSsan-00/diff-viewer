import { isDiffEngineMode, type DiffEngineMode } from "./diffEngine/engine";

export type AppMode = {
  diffCalculationMode: DiffCalculationMode;
  diffEngineMode: DiffEngineMode;
  diffHighlightMode: DiffHighlightMode;
  writebackEnabled: boolean;
};

export type DiffCalculationMode = "normal" | "anchor-only";
export type DiffHighlightMode = "normal" | "manual-anchor-only";

type LocationLike = {
  search?: string;
  hash?: string;
};

function normalizeValue(value: string | null): string | null {
  return value?.trim().toLowerCase() ?? null;
}

function parseParams(value: string | undefined): URLSearchParams {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return new URLSearchParams();
  }
  const body = trimmed.startsWith("?") || trimmed.startsWith("#")
    ? trimmed.slice(1)
    : trimmed;
  return new URLSearchParams(body);
}

function readWritebackEnabled(params: URLSearchParams): boolean | null {
  const save = normalizeValue(params.get("save"));
  return save === "on" ? true : null;
}

function readDiffEngineMode(params: URLSearchParams): DiffEngineMode | null {
  const engine = normalizeValue(params.get("engine"));
  return isDiffEngineMode(engine) ? engine : null;
}

function readDiffCalculationMode(params: URLSearchParams): DiffCalculationMode | null {
  const diff = normalizeValue(params.get("diff"));
  return diff === "off" ? "anchor-only" : null;
}

function readDiffHighlightMode(params: URLSearchParams): DiffHighlightMode | null {
  const highlight = normalizeValue(params.get("highlight"));
  return highlight === "off" ? "manual-anchor-only" : null;
}

export function resolveAppMode(location: LocationLike): AppMode {
  const searchParams = parseParams(location.search);
  const hashParams = parseParams(location.hash);

  return {
    diffCalculationMode:
      readDiffCalculationMode(searchParams) ??
      readDiffCalculationMode(hashParams) ??
      "normal",
    diffEngineMode:
      readDiffEngineMode(searchParams) ??
      readDiffEngineMode(hashParams) ??
      "auto",
    diffHighlightMode:
      readDiffHighlightMode(searchParams) ??
      readDiffHighlightMode(hashParams) ??
      "normal",
    writebackEnabled:
      readWritebackEnabled(searchParams) ?? false,
  };
}
