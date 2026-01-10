import { describe, it, expect, vi } from "vitest";
import { handleFindShortcut } from "./editorFind";

function createEditor(hasFocus: boolean, run: () => void) {
  return {
    hasTextFocus: () => hasFocus,
    getAction: () => ({ run }),
  };
}

describe("handleFindShortcut", () => {
  it("runs find on the focused left editor", () => {
    const leftRun = vi.fn();
    const rightRun = vi.fn();
    const left = createEditor(true, leftRun);
    const right = createEditor(false, rightRun);
    const event = {
      ctrlKey: true,
      metaKey: false,
      key: "f",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    const handled = handleFindShortcut(event, {
      left,
      right,
      getLastFocused: () => "right",
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(leftRun).toHaveBeenCalledTimes(1);
    expect(rightRun).not.toHaveBeenCalled();
  });

  it("runs find on the focused right editor", () => {
    const leftRun = vi.fn();
    const rightRun = vi.fn();
    const left = createEditor(false, leftRun);
    const right = createEditor(true, rightRun);
    const event = {
      ctrlKey: false,
      metaKey: true,
      key: "F",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    const handled = handleFindShortcut(event, {
      left,
      right,
      getLastFocused: () => "left",
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(rightRun).toHaveBeenCalledTimes(1);
    expect(leftRun).not.toHaveBeenCalled();
  });

  it("falls back to the last focused editor when none is focused", () => {
    const leftRun = vi.fn();
    const rightRun = vi.fn();
    const left = createEditor(false, leftRun);
    const right = createEditor(false, rightRun);
    const event = {
      ctrlKey: true,
      metaKey: false,
      key: "f",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    const handled = handleFindShortcut(event, {
      left,
      right,
      getLastFocused: () => "right",
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(rightRun).toHaveBeenCalledTimes(1);
    expect(leftRun).not.toHaveBeenCalled();
  });

  it("uses trigger when find action is unavailable", () => {
    const trigger = vi.fn();
    const event = {
      ctrlKey: true,
      metaKey: false,
      key: "f",
      code: "KeyF",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    const handled = handleFindShortcut(event, {
      left: {
        hasTextFocus: () => true,
        getAction: () => null,
        trigger,
      },
      right: createEditor(false, vi.fn()),
      getLastFocused: () => "left",
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(trigger).toHaveBeenCalledWith("keyboard", "actions.find", null);
  });
});
