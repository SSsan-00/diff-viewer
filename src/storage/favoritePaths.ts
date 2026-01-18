export const FAVORITE_PATH_LIMIT = 10;

export type FavoritePane = "left" | "right";
export type FavoritePathError = "empty" | "duplicate" | "limit";

export type FavoritePathResult =
  | { ok: true; paths: string[] }
  | { ok: false; reason: FavoritePathError; paths: string[] };

const FAVORITE_PATH_LEGACY_KEYS: Record<FavoritePane, string> = {
  left: "diffViewer.favoritePaths.left",
  right: "diffViewer.favoritePaths.right",
};

function getWorkspaceKey(pane: FavoritePane, workspaceId: string): string {
  return `diffViewer.favoritePaths.${pane}.${workspaceId}`;
}

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
  workspaceId: string,
): string[] {
  if (!storage) {
    return [];
  }
  try {
    const workspaceKey = getWorkspaceKey(pane, workspaceId);
    const raw = storage.getItem(workspaceKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeFavoritePaths(parsed);
      if (Array.isArray(parsed)) {
        const needsSave =
          normalized.length !== parsed.length ||
          normalized.some((value, index) => value !== parsed[index]);
        if (needsSave) {
          saveFavoritePaths(storage, pane, workspaceId, normalized);
        }
      }
      return normalized;
    }
    const legacyKey = FAVORITE_PATH_LEGACY_KEYS[pane];
    const legacyRaw = storage.getItem(legacyKey);
    if (!legacyRaw) {
      return [];
    }
    const legacyParsed = JSON.parse(legacyRaw);
    const legacyNormalized = normalizeFavoritePaths(legacyParsed);
    saveFavoritePaths(storage, pane, workspaceId, legacyNormalized);
    storage.removeItem(legacyKey);
    return legacyNormalized;
  } catch (error) {
    console.warn("Failed to parse favorite paths:", error);
    return [];
  }
}

export function saveFavoritePaths(
  storage: Storage | null,
  pane: FavoritePane,
  workspaceId: string,
  paths: string[],
): void {
  if (!storage) {
    return;
  }
  const key = getWorkspaceKey(pane, workspaceId);
  storage.setItem(key, JSON.stringify(paths));
}

export function addFavoritePath(
  storage: Storage | null,
  pane: FavoritePane,
  workspaceId: string,
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
  saveFavoritePaths(storage, pane, workspaceId, next);
  return { ok: true, paths: next };
}

export function removeFavoritePath(
  storage: Storage | null,
  pane: FavoritePane,
  workspaceId: string,
  paths: string[],
  index: number,
): string[] {
  if (index < 0 || index >= paths.length) {
    return paths;
  }
  const next = paths.filter((_, i) => i !== index);
  saveFavoritePaths(storage, pane, workspaceId, next);
  return next;
}

export function moveFavoritePath(
  storage: Storage | null,
  pane: FavoritePane,
  workspaceId: string,
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
  saveFavoritePaths(storage, pane, workspaceId, next);
  return next;
}
