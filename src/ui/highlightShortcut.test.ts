import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handleHighlightShortcut } from "./highlightShortcut";

describe("highlight shortcut", () => {
  it("toggles with Alt+H", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let toggled = false;
    const event = new dom.window.KeyboardEvent("keydown", {
      key: "h",
      altKey: true,
      bubbles: true,
    });

    const handled = handleHighlightShortcut(event, {
      toggle: () => {
        toggled = true;
      },
    });

    expect(handled).toBe(true);
    expect(toggled).toBe(true);
  });
});
