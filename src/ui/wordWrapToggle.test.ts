import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindWordWrapToggle } from "./wordWrapToggle";

describe("word wrap toggle", () => {
  it("turns word wrap on when checked", () => {
    const dom = new JSDOM(`<input id="wrap" type="checkbox" />`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#wrap");
    const editor = { updateOptions: vi.fn(), layout: vi.fn() };
    const afterToggle = vi.fn();
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };

    bindWordWrapToggle(input, editor, afterToggle, requestFrame);

    input!.checked = true;
    input!.dispatchEvent(new dom.window.Event("change"));

    expect(editor.updateOptions).toHaveBeenCalledWith({ wordWrap: "on" });
    expect(editor.layout).toHaveBeenCalledTimes(1);
    expect(afterToggle).toHaveBeenCalledTimes(0);

    frames.shift()?.(0);
    frames.shift()?.(0);
    expect(afterToggle).toHaveBeenCalledTimes(1);
  });

  it("turns word wrap off when unchecked", () => {
    const dom = new JSDOM(`<input id="wrap" type="checkbox" />`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#wrap");
    const editor = { updateOptions: vi.fn(), layout: vi.fn() };
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };

    bindWordWrapToggle(input, editor, undefined, requestFrame);

    input!.checked = false;
    input!.dispatchEvent(new dom.window.Event("change"));

    expect(editor.updateOptions).toHaveBeenCalledWith({ wordWrap: "off" });
    expect(editor.layout).toHaveBeenCalledTimes(1);
    frames.shift()?.(0);
    frames.shift()?.(0);
  });
});
