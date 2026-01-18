import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  addFavoritePath,
  loadFavoritePaths,
  moveFavoritePath,
  removeFavoritePath,
  saveFavoritePaths,
  FAVORITE_PATH_LIMIT,
} from "./favoritePaths";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

describe("favorite paths storage", () => {
  it("stores left/right independently", () => {
    const storage = createStorage();
    saveFavoritePaths(storage, "left", ["left.txt"]);
    saveFavoritePaths(storage, "right", ["right.txt"]);

    expect(loadFavoritePaths(storage, "left")).toEqual(["left.txt"]);
    expect(loadFavoritePaths(storage, "right")).toEqual(["right.txt"]);
  });

  it("rejects empty, duplicate, and over-limit entries", () => {
    const storage = createStorage();
    let paths: string[] = [];

    expect(addFavoritePath(storage, "left", paths, "")).toEqual({
      ok: false,
      reason: "empty",
      paths: [],
    });

    const first = addFavoritePath(storage, "left", paths, "path.txt");
    expect(first.ok).toBe(true);
    paths = first.ok ? first.paths : paths;

    expect(addFavoritePath(storage, "left", paths, "path.txt")).toEqual({
      ok: false,
      reason: "duplicate",
      paths,
    });

    const full = Array.from({ length: FAVORITE_PATH_LIMIT }, (_, i) => `p${i}`);
    saveFavoritePaths(storage, "left", full);
    expect(addFavoritePath(storage, "left", full, "overflow")).toEqual({
      ok: false,
      reason: "limit",
      paths: full,
    });
  });

  it("moves and removes entries", () => {
    const storage = createStorage();
    const initial = ["a", "b", "c"];
    saveFavoritePaths(storage, "left", initial);

    const moved = moveFavoritePath(storage, "left", initial, 2, 0);
    expect(moved).toEqual(["c", "a", "b"]);

    const removed = removeFavoritePath(storage, "left", moved, 1);
    expect(removed).toEqual(["c", "b"]);
  });

  it("clamps stored paths to the max limit on load", () => {
    const storage = createStorage();
    const overflow = Array.from(
      { length: FAVORITE_PATH_LIMIT + 3 },
      (_, index) => `p${index}`,
    );
    saveFavoritePaths(storage, "left", overflow);

    const loaded = loadFavoritePaths(storage, "left");

    expect(loaded).toEqual(overflow.slice(0, FAVORITE_PATH_LIMIT));
  });
});
