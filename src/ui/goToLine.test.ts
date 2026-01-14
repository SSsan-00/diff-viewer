import { describe, expect, it, vi } from "vitest";
import { handleGoToLineShortcut } from "./goToLine";

function createEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent;
}

describe("handleGoToLineShortcut", () => {
  it("opens the left panel when left editor is focused", () => {
    const open = vi.fn();
    const close = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "g", code: "KeyG" });
    const handled = handleGoToLineShortcut(event, {
      left: { hasTextFocus: () => true },
      right: { hasTextFocus: () => false },
      getLastFocused: () => "right",
      open,
      close,
      isOpen: () => false,
    });

    expect(handled).toBe(true);
    expect(open).toHaveBeenCalledWith("left");
    expect(close).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("falls back to last focused side when no editor has focus", () => {
    const open = vi.fn();
    const close = vi.fn();
    const event = createEvent({ metaKey: true, key: "G", code: "KeyG" });
    const handled = handleGoToLineShortcut(event, {
      left: { hasTextFocus: () => false },
      right: { hasTextFocus: () => false },
      getLastFocused: () => "right",
      open,
      close,
      isOpen: () => false,
    });

    expect(handled).toBe(true);
    expect(open).toHaveBeenCalledWith("right");
  });

  it("closes the panel when already open", () => {
    const open = vi.fn();
    const close = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "g", code: "KeyG" });
    const handled = handleGoToLineShortcut(event, {
      left: { hasTextFocus: () => true },
      right: { hasTextFocus: () => false },
      getLastFocused: () => "right",
      open,
      close,
      isOpen: () => true,
    });

    expect(handled).toBe(true);
    expect(close).toHaveBeenCalledWith("left");
    expect(open).not.toHaveBeenCalled();
  });
});
