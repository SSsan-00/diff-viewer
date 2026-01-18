import { describe, expect, it, vi } from "vitest";
import {
  handleGoToLineFileMoveShortcut,
  moveSelectedIndex,
  resolveGoToLineMoveDelta,
} from "./goToLineNavigation";

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

describe("moveSelectedIndex", () => {
  it("clamps to the start", () => {
    expect(moveSelectedIndex(0, -1, 3)).toBe(0);
  });

  it("clamps to the end", () => {
    expect(moveSelectedIndex(2, 1, 3)).toBe(2);
  });

  it("moves within range", () => {
    expect(moveSelectedIndex(1, 1, 3)).toBe(2);
  });
});

describe("resolveGoToLineMoveDelta", () => {
  it("maps ctrl+j and ctrl+k", () => {
    expect(resolveGoToLineMoveDelta(createEvent({ ctrlKey: true, key: "j" }))).toBe(-1);
    expect(resolveGoToLineMoveDelta(createEvent({ ctrlKey: true, key: "k" }))).toBe(1);
  });

  it("maps arrow keys", () => {
    expect(resolveGoToLineMoveDelta(createEvent({ key: "ArrowLeft" }))).toBe(-1);
    expect(resolveGoToLineMoveDelta(createEvent({ key: "ArrowRight" }))).toBe(1);
  });

  it("returns null for unrelated keys", () => {
    expect(resolveGoToLineMoveDelta(createEvent({ key: "x" }))).toBeNull();
  });
});

describe("handleGoToLineFileMoveShortcut", () => {
  it("does nothing when panel is closed", () => {
    const move = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "j" });
    const handled = handleGoToLineFileMoveShortcut(event, { isOpen: false, move });
    expect(handled).toBe(false);
    expect(move).not.toHaveBeenCalled();
  });

  it("moves selection when panel is open", () => {
    const move = vi.fn();
    const event = createEvent({ ctrlKey: true, key: "k" });
    const handled = handleGoToLineFileMoveShortcut(event, { isOpen: true, move });
    expect(handled).toBe(true);
    expect(move).toHaveBeenCalledWith(1);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });
});
