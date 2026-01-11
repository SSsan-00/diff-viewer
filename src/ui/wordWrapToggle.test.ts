import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindWordWrapToggle } from "./wordWrapToggle";

describe("word wrap toggle", () => {
  it("turns word wrap on when checked", () => {
    const dom = new JSDOM(`<input id="wrap" type="checkbox" />`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#wrap");
    const leftEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const rightEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const afterToggle = vi.fn();
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };

    bindWordWrapToggle({
      input,
      editors: [leftEditor, rightEditor],
      onAfterToggle: afterToggle,
      requestFrame,
      keyTarget: dom.window,
    });

    input!.checked = true;
    input!.dispatchEvent(new dom.window.Event("change"));

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
    expect(leftEditor.layout).toHaveBeenCalledTimes(1);
    expect(rightEditor.layout).toHaveBeenCalledTimes(1);
    expect(afterToggle).toHaveBeenCalledTimes(0);

    frames.shift()?.(0);
    frames.shift()?.(0);
    expect(afterToggle).toHaveBeenCalledTimes(1);
  });

  it("turns word wrap off when unchecked", () => {
    const dom = new JSDOM(`<input id="wrap" type="checkbox" />`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#wrap");
    const leftEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const rightEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };

    bindWordWrapToggle({
      input,
      editors: [leftEditor, rightEditor],
      requestFrame,
      keyTarget: dom.window,
    });

    input!.checked = false;
    input!.dispatchEvent(new dom.window.Event("change"));

    expect(leftEditor.updateOptions).toHaveBeenCalledWith({
      wordWrap: "off",
      wrappingStrategy: "advanced",
      lineHeight: 22,
    });
    expect(rightEditor.updateOptions).toHaveBeenCalledWith({
      wordWrap: "off",
      wrappingStrategy: "advanced",
      lineHeight: 22,
    });
    expect(leftEditor.layout).toHaveBeenCalledTimes(1);
    expect(rightEditor.layout).toHaveBeenCalledTimes(1);
    frames.shift()?.(0);
    frames.shift()?.(0);
  });

  it("toggles word wrap with Alt+Z", () => {
    const dom = new JSDOM(`<input id="wrap" type="checkbox" />`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#wrap");
    const leftEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const rightEditor = { updateOptions: vi.fn(), layout: vi.fn() };
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };

    bindWordWrapToggle({
      input,
      editors: [leftEditor, rightEditor],
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
    expect(input!.checked).toBe(true);
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
