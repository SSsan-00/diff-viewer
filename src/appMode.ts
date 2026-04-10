export type AppMode = {
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

export function resolveAppMode(location: LocationLike): AppMode {
  const searchMode = readWritebackEnabled(parseParams(location.search));
  if (searchMode !== null) {
    return { writebackEnabled: searchMode };
  }

  const hashMode = readWritebackEnabled(parseParams(location.hash));
  if (hashMode !== null) {
    return { writebackEnabled: hashMode };
  }

  return { writebackEnabled: false };
}
