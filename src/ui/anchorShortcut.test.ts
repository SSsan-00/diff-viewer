import { describe, expect, it, vi } from "vitest";
import { handleAnchorShortcut } from "./anchorShortcut";

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

describe("handleAnchorShortcut", () => {
  it("adds anchor on left when ctrl+l is pressed and left has focus", () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "l" });

    const handled = handleAnchorShortcut(event, {
      left: {
        hasTextFocus: () => true,
        getPosition: () => ({ lineNumber: 5 }),
      },
      right: {
        hasTextFocus: () => false,
        getPosition: () => null,
      },
      onLeft,
      onRight,
    });

    expect(handled).toBe(true);
    expect(onLeft).toHaveBeenCalledWith(4);
    expect(onRight).not.toHaveBeenCalled();
  });

  it("adds anchor on right when ctrl+l is pressed and right has focus", () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "l" });

    const handled = handleAnchorShortcut(event, {
      left: {
        hasTextFocus: () => false,
        getPosition: () => null,
      },
      right: {
        hasTextFocus: () => true,
        getPosition: () => ({ lineNumber: 2 }),
      },
      onLeft,
      onRight,
    });

    expect(handled).toBe(true);
    expect(onRight).toHaveBeenCalledWith(1);
  });

  it("ignores other keys", () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "x" });

    const handled = handleAnchorShortcut(event, {
      left: {
        hasTextFocus: () => true,
        getPosition: () => ({ lineNumber: 1 }),
      },
      right: {
        hasTextFocus: () => false,
        getPosition: () => null,
      },
      onLeft,
      onRight,
    });

    expect(handled).toBe(false);
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });
});
