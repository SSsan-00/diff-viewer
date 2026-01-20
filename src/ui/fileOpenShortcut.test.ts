import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handleFileOpenShortcut } from "./fileOpenShortcut";

describe("file open shortcut", () => {
  it("opens the left picker on Ctrl+U when left is focused", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let leftOpened = false;
    let rightOpened = false;
    const event = new dom.window.KeyboardEvent("keydown", {
      key: "u",
      ctrlKey: true,
      bubbles: true,
    });

    const handled = handleFileOpenShortcut(event, {
      openLeft: () => {
        leftOpened = true;
      },
      openRight: () => {
        rightOpened = true;
      },
      getLastFocused: () => "left",
    });

    expect(handled).toBe(true);
    expect(leftOpened).toBe(true);
    expect(rightOpened).toBe(false);
  });

  it("opens the right picker on Ctrl+U when right is focused", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let leftOpened = false;
    let rightOpened = false;
    const event = new dom.window.KeyboardEvent("keydown", {
      code: "KeyU",
      ctrlKey: true,
      bubbles: true,
    });

    const handled = handleFileOpenShortcut(event, {
      openLeft: () => {
        leftOpened = true;
      },
      openRight: () => {
        rightOpened = true;
      },
      getLastFocused: () => "right",
    });

    expect(handled).toBe(true);
    expect(leftOpened).toBe(false);
    expect(rightOpened).toBe(true);
  });
});
