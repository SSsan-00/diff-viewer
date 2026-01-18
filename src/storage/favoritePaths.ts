export const FAVORITE_PATH_LIMIT = 10;

export type FavoritePane = "left" | "right";
export type FavoritePathError = "empty" | "duplicate" | "limit";

export type FavoritePathResult =
  | { ok: true; paths: string[] }
  | { ok: false; reason: FavoritePathError; paths: string[] };

const FAVORITE_PATH_KEYS: Record<FavoritePane, string> = {
  left: "diffViewer.favoritePaths.left",
  right: "diffViewer.favoritePaths.right",
};

function normalizeFavoritePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const filtered = raw.filter((item) => typeof item === "string");
  if (filtered.length <= FAVORITE_PATH_LIMIT) {
    return filtered;
  }
  return filtered.slice(0, FAVORITE_PATH_LIMIT);
}

export function loadFavoritePaths(
  storage: Storage | null,
  pane: FavoritePane,
): string[] {
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(FAVORITE_PATH_KEYS[pane]);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeFavoritePaths(parsed);
    if (storage && Array.isArray(parsed)) {
      const needsSave =
        normalized.length !== parsed.length ||
        normalized.some((value, index) => value !== parsed[index]);
      if (needsSave) {
        saveFavoritePaths(storage, pane, normalized);
      }
    }
    return normalized;
  } catch (error) {
    console.warn("Failed to parse favorite paths:", error);
    return [];
  }
}

export function saveFavoritePaths(
  storage: Storage | null,
  pane: FavoritePane,
  paths: string[],
): void {
  if (!storage) {
    return;
  }
  storage.setItem(FAVORITE_PATH_KEYS[pane], JSON.stringify(paths));
}

export function addFavoritePath(
  storage: Storage | null,
  pane: FavoritePane,
  paths: string[],
  rawPath: string,
): FavoritePathResult {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", paths };
  }
  if (paths.includes(trimmed)) {
    return { ok: false, reason: "duplicate", paths };
  }
  if (paths.length >= FAVORITE_PATH_LIMIT) {
    return { ok: false, reason: "limit", paths };
  }
  const next = [...paths, trimmed];
  saveFavoritePaths(storage, pane, next);
  return { ok: true, paths: next };
}

export function removeFavoritePath(
  storage: Storage | null,
  pane: FavoritePane,
  paths: string[],
  index: number,
): string[] {
  if (index < 0 || index >= paths.length) {
    return paths;
  }
  const next = paths.filter((_, i) => i !== index);
  saveFavoritePaths(storage, pane, next);
  return next;
}

export function moveFavoritePath(
  storage: Storage | null,
  pane: FavoritePane,
  paths: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex < 0 ||
    fromIndex >= paths.length ||
    toIndex < 0 ||
    toIndex >= paths.length ||
    fromIndex === toIndex
  ) {
    return paths;
  }
  const next = [...paths];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  saveFavoritePaths(storage, pane, next);
  return next;
}
