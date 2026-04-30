import { isDiffEngineMode, type DiffEngineMode } from "./diffEngine/engine";

export type AppMode = {
  diffEngineMode: DiffEngineMode;
  writebackEnabled: boolean;
};

type LocationLike = {
  search?: string;
  hash?: string;
};

const DISABLED_VALUES = new Set(["0", "false", "off", "no", "disabled"]);
const ENABLED_VALUES = new Set(["1", "true", "on", "yes", "enabled"]);

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
  if (save && DISABLED_VALUES.has(save)) {
    return false;
  }
  if (save && ENABLED_VALUES.has(save)) {
    return true;
  }

  const writeback = normalizeValue(params.get("writeback"));
  if (writeback && DISABLED_VALUES.has(writeback)) {
    return false;
  }
  if (writeback && ENABLED_VALUES.has(writeback)) {
    return true;
  }

  const mode = normalizeValue(params.get("mode"));
  if (mode === "no-save" || mode === "readonly" || mode === "read-only") {
    return false;
  }
  if (mode === "save" || mode === "writeback") {
    return true;
  }

  return null;
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
      readWritebackEnabled(searchParams) ??
      readWritebackEnabled(hashParams) ??
      false,
  };
}
