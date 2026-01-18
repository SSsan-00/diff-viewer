import { describe, expect, it, vi } from "vitest";
import { focusEditorAtTop, handlePaneFocusShortcut } from "./paneFocusShortcut";

function createEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent;
}

describe("focusEditorAtTop", () => {
  it("focuses the first visible line", () => {
    const editor = {
      getVisibleRanges: () => [{ startLineNumber: 42 }],
      setPosition: vi.fn(),
      focus: vi.fn(),
    };

    focusEditorAtTop(editor);

    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 42, column: 1 });
    expect(editor.focus).toHaveBeenCalled();
  });

  it("falls back to line 1 when no ranges", () => {
    const editor = {
      getVisibleRanges: () => [],
      setPosition: vi.fn(),
      focus: vi.fn(),
    };

    focusEditorAtTop(editor);

    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 1 });
  });
});

describe("handlePaneFocusShortcut", () => {
  it("focuses left on ctrl+j", () => {
    const focusLeft = vi.fn();
    const focusRight = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "j" });

    const handled = handlePaneFocusShortcut(event, { focusLeft, focusRight });

    expect(handled).toBe(true);
    expect(focusLeft).toHaveBeenCalled();
    expect(focusRight).not.toHaveBeenCalled();
  });

  it("focuses right on ctrl+k", () => {
    const focusLeft = vi.fn();
    const focusRight = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "k" });

    const handled = handlePaneFocusShortcut(event, { focusLeft, focusRight });

    expect(handled).toBe(true);
    expect(focusRight).toHaveBeenCalled();
    expect(focusLeft).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const focusLeft = vi.fn();
    const focusRight = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "x" });

    const handled = handlePaneFocusShortcut(event, { focusLeft, focusRight });

    expect(handled).toBe(false);
    expect(focusLeft).not.toHaveBeenCalled();
    expect(focusRight).not.toHaveBeenCalled();
  });
});
