import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  bindFavoritePathDragHandlers,
  getFavoritePathAction,
  renderFavoritePaths,
} from "./favoritePaths";

describe("favorite paths ui helpers", () => {
  it("renders favorite paths with actions", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderFavoritePaths(container, ["a.txt", "b.txt"]);

    const items = container.querySelectorAll(".favorite-path");
    expect(items.length).toBe(2);
    expect(items[0]?.querySelector("[data-action='copy']")).toBeTruthy();
    expect(items[0]?.querySelector("[data-action='remove']")).toBeTruthy();
    expect(items[0]?.querySelector(".favorite-path__drag")).toBeTruthy();
  });

  it("extracts favorite path actions from targets", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderFavoritePaths(container, ["one.txt"]);

    const remove = container.querySelector<HTMLElement>("[data-action='remove']");
    const action = remove ? getFavoritePathAction(remove) : null;

    expect(action).toEqual({
      type: "remove",
      index: 0,
      path: "one.txt",
    });
  });

  it("keeps copy button enabled for non-empty paths", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderFavoritePaths(container, ["path/to/file.txt"]);

    const copy = container.querySelector<HTMLButtonElement>(
      "[data-action='copy']",
    );

    expect(copy?.disabled).toBe(false);
  });

  it("emits drag move events when items are dropped", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderFavoritePaths(container, ["first.txt", "second.txt"]);

    const moves: Array<{ from: number; to: number }> = [];
    bindFavoritePathDragHandlers(container, (move) => moves.push(move));

    const handles = container.querySelectorAll<HTMLElement>(".favorite-path__drag");
    const items = container.querySelectorAll<HTMLElement>(".favorite-path");
    const dragStart = new dom.window.Event("dragstart", { bubbles: true });
    Object.defineProperty(dragStart, "dataTransfer", {
      value: {
        effectAllowed: "",
        setData: () => undefined,
        setDragImage: () => undefined,
      },
    });
    handles[0]?.dispatchEvent(dragStart);

    const dragOver = new dom.window.Event("dragover", { bubbles: true });
    items[1]?.dispatchEvent(dragOver);

    const drop = new dom.window.Event("drop", { bubbles: true });
    items[1]?.dispatchEvent(drop);

    expect(moves).toEqual([{ from: 0, to: 1 }]);
  });
});
