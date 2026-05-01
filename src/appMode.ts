import { isDiffEngineMode, type DiffEngineMode } from "./diffEngine/engine";

export type AppMode = {
  diffEngineMode: DiffEngineMode;
  writebackEnabled: boolean;
};

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

export function resolveAppMode(location: LocationLike): AppMode {
  const searchParams = parseParams(location.search);
  const hashParams = parseParams(location.hash);

  return {
    diffEngineMode:
      readDiffEngineMode(searchParams) ??
      readDiffEngineMode(hashParams) ??
      "auto",
    writebackEnabled:
      readWritebackEnabled(searchParams) ?? false,
  };
}
