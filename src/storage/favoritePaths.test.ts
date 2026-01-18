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
  it("stores paths per workspace and pane", () => {
    const storage = createStorage();
    saveFavoritePaths(storage, "left", "ws-a", ["left-a.txt"]);
    saveFavoritePaths(storage, "left", "ws-b", ["left-b.txt"]);
    saveFavoritePaths(storage, "right", "ws-a", ["right-a.txt"]);

    expect(loadFavoritePaths(storage, "left", "ws-a")).toEqual(["left-a.txt"]);
    expect(loadFavoritePaths(storage, "left", "ws-b")).toEqual(["left-b.txt"]);
    expect(loadFavoritePaths(storage, "right", "ws-a")).toEqual(["right-a.txt"]);
  });

  it("rejects empty, duplicate, and over-limit entries", () => {
    const storage = createStorage();
    let paths: string[] = [];

    expect(addFavoritePath(storage, "left", "ws-a", paths, "")).toEqual({
      ok: false,
      reason: "empty",
      paths: [],
    });

    const first = addFavoritePath(storage, "left", "ws-a", paths, "path.txt");
    expect(first.ok).toBe(true);
    paths = first.ok ? first.paths : paths;

    expect(addFavoritePath(storage, "left", "ws-a", paths, "path.txt")).toEqual({
      ok: false,
      reason: "duplicate",
      paths,
    });

    const full = Array.from({ length: FAVORITE_PATH_LIMIT }, (_, i) => `p${i}`);
    saveFavoritePaths(storage, "left", "ws-a", full);
    expect(addFavoritePath(storage, "left", "ws-a", full, "overflow")).toEqual({
      ok: false,
      reason: "limit",
      paths: full,
    });
  });

  it("moves and removes entries", () => {
    const storage = createStorage();
    const initial = ["a", "b", "c"];
    saveFavoritePaths(storage, "left", "ws-a", initial);

    const moved = moveFavoritePath(storage, "left", "ws-a", initial, 2, 0);
    expect(moved).toEqual(["c", "a", "b"]);

    const removed = removeFavoritePath(storage, "left", "ws-a", moved, 1);
    expect(removed).toEqual(["c", "b"]);
  });

  it("clamps stored paths to the max limit on load", () => {
    const storage = createStorage();
    const overflow = Array.from(
      { length: FAVORITE_PATH_LIMIT + 3 },
      (_, index) => `p${index}`,
    );
    saveFavoritePaths(storage, "left", "ws-a", overflow);

    const loaded = loadFavoritePaths(storage, "left", "ws-a");

    expect(loaded).toEqual(overflow.slice(0, FAVORITE_PATH_LIMIT));
  });

  it("migrates legacy keys into the selected workspace", () => {
    const storage = createStorage();
    storage.setItem(
      "diffViewer.favoritePaths.left",
      JSON.stringify(["legacy-a", "legacy-b"]),
    );

    const loaded = loadFavoritePaths(storage, "left", "ws-a");

    expect(loaded).toEqual(["legacy-a", "legacy-b"]);
    expect(storage.getItem("diffViewer.favoritePaths.left")).toBeNull();
    expect(
      JSON.parse(
        storage.getItem("diffViewer.favoritePaths.left.ws-a") ?? "[]",
      ),
    ).toEqual(["legacy-a", "legacy-b"]);
  });

  it("prefers workspace keys when both legacy and workspace data exist", () => {
    const storage = createStorage();
    storage.setItem(
      "diffViewer.favoritePaths.left",
      JSON.stringify(["legacy-only"]),
    );
    saveFavoritePaths(storage, "left", "ws-a", ["workspace-only"]);

    const loaded = loadFavoritePaths(storage, "left", "ws-a");

    expect(loaded).toEqual(["workspace-only"]);
    expect(storage.getItem("diffViewer.favoritePaths.left")).not.toBeNull();
  });
});
