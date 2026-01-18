import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { focusFavoriteInputOnKey } from "./favoritePanelKeyRouting";

describe("favorite panel key routing", () => {
  it("focuses the input on printable keys when not focused", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const input = doc.createElement("input");
    doc.body.appendChild(input);

    const event = new dom.window.KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
    });
    const focused = focusFavoriteInputOnKey(event, input);

    expect(focused).toBe(true);
    expect(doc.activeElement).toBe(input);
  });

  it("ignores modifier shortcuts and Enter/Tab/Escape", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const input = doc.createElement("input");
    doc.body.appendChild(input);

    const ctrlEvent = new dom.window.KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
    });
    const enterEvent = new dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });

    expect(focusFavoriteInputOnKey(ctrlEvent, input)).toBe(false);
    expect(focusFavoriteInputOnKey(enterEvent, input)).toBe(false);
  });
});
