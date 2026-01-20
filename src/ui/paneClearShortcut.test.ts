import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handlePaneClearShortcut } from "./paneClearShortcut";

describe("pane clear shortcut", () => {
  it("clears the focused pane with Ctrl+I", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let focused = false;
    let all = false;
    const event = new dom.window.KeyboardEvent("keydown", {
      key: "i",
      ctrlKey: true,
      bubbles: true,
    });

    const handled = handlePaneClearShortcut(event, {
      clearFocused: () => {
        focused = true;
      },
      clearAll: () => {
        all = true;
      },
    });

    expect(handled).toBe(true);
    expect(focused).toBe(true);
    expect(all).toBe(false);
  });

  it("clears all panes with Ctrl+Shift+I", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let focused = false;
    let all = false;
    const event = new dom.window.KeyboardEvent("keydown", {
      code: "KeyI",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });

    const handled = handlePaneClearShortcut(event, {
      clearFocused: () => {
        focused = true;
      },
      clearAll: () => {
        all = true;
      },
    });

    expect(handled).toBe(true);
    expect(focused).toBe(false);
    expect(all).toBe(true);
  });
});
