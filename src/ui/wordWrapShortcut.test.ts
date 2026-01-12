import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindWordWrapShortcut } from "./wordWrapShortcut";

describe("word wrap shortcut", () => {
  it("toggles word wrap with Alt+Z", () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    const leftEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const rightEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    let enabled = false;
    const setEnabled = vi.fn((next: boolean) => {
      enabled = next;
    });
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };

    bindWordWrapShortcut({
      editors: [leftEditor, rightEditor],
      getEnabled: () => enabled,
      setEnabled,
      requestFrame,
      keyTarget: dom.window,
    });

    const event = new dom.window.KeyboardEvent("keydown", {
      key: "z",
      altKey: true,
      cancelable: true,
    });
    dom.window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(leftEditor.updateOptions).toHaveBeenCalledWith({
      wordWrap: "on",
      wrappingStrategy: "advanced",
      lineHeight: 22,
    });
    expect(rightEditor.updateOptions).toHaveBeenCalledWith({
      wordWrap: "on",
      wrappingStrategy: "advanced",
      lineHeight: 22,
    });
    frames.shift()?.(0);
    frames.shift()?.(0);
  });
});
