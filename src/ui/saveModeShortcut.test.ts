import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  bindSaveModeShortcut,
  createSaveModeShortcutState,
  createSaveModeUrl,
  handleSaveModeShortcut,
} from "./saveModeShortcut";

function keydown(window: Window, key: string, code = `Digit${key}`): KeyboardEvent {
  return new window.KeyboardEvent("keydown", {
    key,
    code,
    ctrlKey: true,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
}

describe("save mode shortcut", () => {
  it("adds save=on while preserving other parameters and hash", () => {
    expect(
      createSaveModeUrl(
        "https://example.test/index.html?diff=off&highlight=off#top",
        "enable",
      ),
    ).toBe("https://example.test/index.html?diff=off&highlight=off&save=on#top");
  });

  it("removes only save=on while preserving other parameters and hash", () => {
    expect(
      createSaveModeUrl(
        "https://example.test/index.html?save=on&diff=off&manual=on#top",
        "disable",
      ),
    ).toBe("https://example.test/index.html?diff=off&manual=on#top");
  });

  it("opens save mode after Ctrl+Alt+999 when save=on is absent", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createSaveModeShortcutState();

    for (const event of [
      keydown(dom.window, "9"),
      keydown(dom.window, "9"),
      keydown(dom.window, "9"),
    ]) {
      expect(
        handleSaveModeShortcut(event, state, {
          getHref: () => "https://example.test/index.html?diff=off",
          open,
        }),
      ).toBe(true);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      "https://example.test/index.html?diff=off&save=on",
    );
  });

  it("opens without save mode after Ctrl+Alt+777 when save=on is present", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createSaveModeShortcutState();

    for (const event of [
      keydown(dom.window, "7"),
      keydown(dom.window, "7"),
      keydown(dom.window, "7"),
    ]) {
      handleSaveModeShortcut(event, state, {
        getHref: () => "https://example.test/index.html?save=on&highlight=off",
        open,
      });
    }

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      "https://example.test/index.html?highlight=off",
    );
  });

  it("does not reopen when the requested save mode is already active", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createSaveModeShortcutState();

    for (const event of [
      keydown(dom.window, "9"),
      keydown(dom.window, "9"),
      keydown(dom.window, "9"),
    ]) {
      handleSaveModeShortcut(event, state, {
        getHref: () => "https://example.test/index.html?save=on",
        open,
      });
    }

    expect(open).not.toHaveBeenCalled();
  });

  it("resets the sequence after another key", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const state = createSaveModeShortcutState();
    const context = {
      getHref: () => "https://example.test/index.html",
      open,
    };

    handleSaveModeShortcut(keydown(dom.window, "9"), state, context);
    handleSaveModeShortcut(
      new dom.window.KeyboardEvent("keydown", {
        key: "x",
        code: "KeyX",
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
      state,
      context,
    );
    handleSaveModeShortcut(keydown(dom.window, "9"), state, context);
    handleSaveModeShortcut(keydown(dom.window, "9"), state, context);

    expect(open).not.toHaveBeenCalled();
  });

  it("binds the shortcut to a key target", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const open = vi.fn();
    const unbind = bindSaveModeShortcut({
      keyTarget: dom.window,
      getHref: () => "https://example.test/index.html",
      open,
    });

    dom.window.dispatchEvent(keydown(dom.window, "9"));
    dom.window.dispatchEvent(keydown(dom.window, "9"));
    dom.window.dispatchEvent(keydown(dom.window, "9"));
    unbind();

    expect(open).toHaveBeenCalledWith("https://example.test/index.html?save=on");
  });
});
