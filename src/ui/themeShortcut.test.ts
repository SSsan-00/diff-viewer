import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handleThemeShortcut } from "./themeShortcut";

describe("theme shortcut", () => {
  it("toggles with Alt+T", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let toggled = false;
    const event = new dom.window.KeyboardEvent("keydown", {
      key: "t",
      altKey: true,
      bubbles: true,
    });

    const handled = handleThemeShortcut(event, {
      toggle: () => {
        toggled = true;
      },
    });

    expect(handled).toBe(true);
    expect(toggled).toBe(true);
  });
});
