import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  bindVimPlugShortcut,
  createVimPlugShortcutState,
  createVimPlugUrl,
  handleVimPlugShortcut,
} from "./vimPlugShortcut";

function prefix(window: Window): KeyboardEvent {
  return new window.KeyboardEvent("keydown", {
    key: "v",
    code: "KeyV",
    ctrlKey: true,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
}

function key(window: Window, value: string, code = ""): KeyboardEvent {
  return new window.KeyboardEvent("keydown", {
    key: value,
    code,
    bubbles: true,
    cancelable: true,
  });
}

describe("Vim plug shortcut", () => {
  it("adds entry=plug while preserving other parameters and hash", () => {
    expect(
      createVimPlugUrl(
        "https://example.test/index.html?save=on&diff=off#top",
        "enable",
      ),
    ).toBe("https://example.test/index.html?save=on&diff=off&entry=plug#top");
  });

  it("removes only entry while preserving other parameters and hash", () => {
    expect(
      createVimPlugUrl(
        "https://example.test/index.html?entry=plug&save=on#top",
        "disable",
      ),
    ).toBe("https://example.test/index.html?save=on#top");
  });

  it("opens plug mode after Ctrl+Alt+V then colon", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createVimPlugShortcutState();
    const context = {
      getHref: () => "https://example.test/index.html?save=on",
      open,
    };

    const first = prefix(dom.window);
    const second = key(dom.window, ":");
    expect(handleVimPlugShortcut(first, state, context)).toBe(true);
    expect(handleVimPlugShortcut(second, state, context)).toBe(true);

    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith(
      "https://example.test/index.html?save=on&entry=plug",
    );
  });

  it("quits plug mode after Ctrl+Alt+V then q", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createVimPlugShortcutState();
    const context = {
      getHref: () => "https://example.test/index.html?entry=plug&save=on",
      open,
    };

    handleVimPlugShortcut(prefix(dom.window), state, context);
    handleVimPlugShortcut(key(dom.window, "q", "KeyQ"), state, context);

    expect(open).toHaveBeenCalledWith("https://example.test/index.html?save=on");
  });

  it("does not reopen when the requested plug mode is already active", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createVimPlugShortcutState();

    handleVimPlugShortcut(prefix(dom.window), state, {
      getHref: () => "https://example.test/index.html?entry=plug",
      open,
    });
    handleVimPlugShortcut(key(dom.window, ":"), state, {
      getHref: () => "https://example.test/index.html?entry=plug",
      open,
    });

    expect(open).not.toHaveBeenCalled();
  });

  it("binds the shortcut to a key target", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const unbind = bindVimPlugShortcut({
      keyTarget: dom.window,
      getHref: () => "https://example.test/index.html",
      open,
    });

    dom.window.dispatchEvent(prefix(dom.window));
    dom.window.dispatchEvent(key(dom.window, ":"));
    unbind();

    expect(open).toHaveBeenCalledWith("https://example.test/index.html?entry=plug");
  });
});
