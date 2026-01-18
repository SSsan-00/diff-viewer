import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handleFavoritePanelShortcut } from "./favoritePanelShortcut";
import type { FavoritePanelController } from "./favoritePanel";

function createController(): FavoritePanelController {
  let open = false;
  return {
    open: () => {
      open = true;
    },
    close: () => {
      open = false;
    },
    toggle: () => {
      open = !open;
    },
    isOpen: () => open,
  };
}

describe("favorite panel shortcut", () => {
  it("toggles the panel for the last focused pane", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const left = createController();
    const right = createController();

    const openEvent = new dom.window.KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
    });
    const handledOpen = handleFavoritePanelShortcut(openEvent, {
      left,
      right,
      getLastFocused: () => "right",
    });

    expect(handledOpen).toBe(true);
    expect(right.isOpen()).toBe(true);
    expect(left.isOpen()).toBe(false);

    const closeEvent = new dom.window.KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
    });
    const handledClose = handleFavoritePanelShortcut(closeEvent, {
      left,
      right,
      getLastFocused: () => "right",
    });

    expect(handledClose).toBe(true);
    expect(right.isOpen()).toBe(false);
  });
});
