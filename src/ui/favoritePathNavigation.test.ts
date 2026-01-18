import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { handleFavoriteListKeydown } from "./favoritePathNavigation";

describe("favorite path keyboard navigation", () => {
  it("moves focus with arrow keys and clamps at edges", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const moves: Array<number | null> = [];

    const downEvent = new dom.window.KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
    });
    handleFavoriteListKeydown(downEvent, {
      length: 3,
      currentIndex: null,
      onMove: (nextIndex) => moves.push(nextIndex),
      onCopy: () => undefined,
      onRemove: () => undefined,
    });

    const upEvent = new dom.window.KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
    });
    handleFavoriteListKeydown(upEvent, {
      length: 3,
      currentIndex: 0,
      onMove: (nextIndex) => moves.push(nextIndex),
      onCopy: () => undefined,
      onRemove: () => undefined,
    });

    expect(moves).toEqual([0, 0]);
  });

  it("copies the focused path on Enter", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const onCopy = vi.fn();
    const onMove = vi.fn();

    const enterEvent = new dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    handleFavoriteListKeydown(enterEvent, {
      length: 2,
      currentIndex: 1,
      onMove,
      onCopy,
      onRemove: () => undefined,
    });

    expect(onCopy).toHaveBeenCalledWith(1);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does nothing on Enter when no selection exists", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const onCopy = vi.fn();

    const enterEvent = new dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    handleFavoriteListKeydown(enterEvent, {
      length: 2,
      currentIndex: null,
      onMove: () => undefined,
      onCopy,
      onRemove: () => undefined,
    });

    expect(onCopy).not.toHaveBeenCalled();
  });

  it("removes the focused path on Delete", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const onRemove = vi.fn();

    const deleteEvent = new dom.window.KeyboardEvent("keydown", {
      key: "Delete",
      bubbles: true,
    });
    handleFavoriteListKeydown(deleteEvent, {
      length: 3,
      currentIndex: 2,
      onMove: () => undefined,
      onCopy: () => undefined,
      onRemove,
    });

    expect(onRemove).toHaveBeenCalledWith(2);
  });
});
