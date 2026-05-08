import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  createVimPaneNavigationState,
  handleVimPaneNavigation,
  shouldLetVimHandleEditorKey,
  type VimEditorMode,
} from "./vimPaneNavigation";

function event(window: Window, key: string, options: KeyboardEventInit = {}) {
  return new window.KeyboardEvent("keydown", {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : "",
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

describe("Vim pane navigation", () => {
  it("focuses the left pane with Ctrl+w h in normal mode", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const state = createVimPaneNavigationState();
    const focusPane = vi.fn();
    const context = {
      enabled: true,
      getFocusedSide: () => "right" as const,
      getMode: () => "normal" as VimEditorMode,
      focusPane,
    };

    const prefix = event(dom.window, "w", { ctrlKey: true });
    const target = event(dom.window, "h");
    expect(handleVimPaneNavigation(prefix, state, context)).toBe(true);
    expect(handleVimPaneNavigation(target, state, context)).toBe(true);

    expect(prefix.defaultPrevented).toBe(true);
    expect(target.defaultPrevented).toBe(true);
    expect(focusPane).toHaveBeenCalledWith("left");
  });

  it("focuses the right pane with Ctrl+w l in normal mode", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const state = createVimPaneNavigationState();
    const focusPane = vi.fn();

    handleVimPaneNavigation(
      event(dom.window, "w", { ctrlKey: true }),
      state,
      {
        enabled: true,
        getFocusedSide: () => "left",
        getMode: () => "normal",
        focusPane,
      },
    );
    handleVimPaneNavigation(
      event(dom.window, "l"),
      state,
      {
        enabled: true,
        getFocusedSide: () => "left",
        getMode: () => "normal",
        focusPane,
      },
    );

    expect(focusPane).toHaveBeenCalledWith("right");
  });

  it("does not steal Ctrl+w in insert mode", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const state = createVimPaneNavigationState();
    const focusPane = vi.fn();
    const prefix = event(dom.window, "w", { ctrlKey: true });

    expect(
      handleVimPaneNavigation(prefix, state, {
        enabled: true,
        getFocusedSide: () => "left",
        getMode: () => "insert",
        focusPane,
      }),
    ).toBe(false);

    expect(prefix.defaultPrevented).toBe(false);
    expect(focusPane).not.toHaveBeenCalled();
  });

  it("lets Vim handle editor Ctrl shortcuts when plug mode is active", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    expect(
      shouldLetVimHandleEditorKey(event(dom.window, "u", { ctrlKey: true }), {
        enabled: true,
        editorFocused: true,
      }),
    ).toBe(true);
  });

  it("keeps Alt shortcuts available for the app", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    expect(
      shouldLetVimHandleEditorKey(event(dom.window, "z", { altKey: true }), {
        enabled: true,
        editorFocused: true,
      }),
    ).toBe(false);
  });
});
