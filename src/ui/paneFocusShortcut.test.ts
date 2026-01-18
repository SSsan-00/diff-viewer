import { describe, expect, it, vi } from "vitest";
import {
  findClosestVisibleLine,
  focusEditorAtAlignedLine,
  focusEditorAtTop,
  handlePaneFocusShortcut,
} from "./paneFocusShortcut";

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
      getVisibleRanges: () => [{ startLineNumber: 42, endLineNumber: 50 }],
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

describe("findClosestVisibleLine", () => {
  it("returns the closest line in range", () => {
    const tops = new Map([
      [10, 100],
      [11, 120],
      [12, 140],
    ]);
    const editor = {
      getVisibleRanges: () => [{ startLineNumber: 10, endLineNumber: 12 }],
      getTopForLineNumber: (line: number) => tops.get(line) ?? 0,
      getPosition: () => ({ lineNumber: 10 }),
    };

    expect(findClosestVisibleLine(editor, 118)).toBe(11);
  });
});

describe("focusEditorAtAlignedLine", () => {
  it("focuses the closest visible line in target editor", () => {
    const fromEditor = {
      getVisibleRanges: () => [{ startLineNumber: 1, endLineNumber: 1 }],
      getTopForLineNumber: () => 200,
      getPosition: () => ({ lineNumber: 5 }),
    };
    const toEditor = {
      getVisibleRanges: () => [{ startLineNumber: 10, endLineNumber: 12 }],
      getTopForLineNumber: (line: number) => 100 + (line - 10) * 20,
      getPosition: () => ({ lineNumber: 10 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      revealLineInCenter: vi.fn(),
      getModel: () => ({ getLineCount: () => 200 }),
    };

    focusEditorAtAlignedLine(fromEditor, toEditor);

    expect(toEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 12, column: 1 });
    expect(toEditor.focus).toHaveBeenCalled();
  });
});

describe("handlePaneFocusShortcut", () => {
  it("focuses left on ctrl+j", () => {
    const event = createEvent({ ctrlKey: true, key: "j" });
    const leftEditor = {
      getVisibleRanges: () => [{ startLineNumber: 1, endLineNumber: 3 }],
      getTopForLineNumber: () => 50,
      getPosition: () => ({ lineNumber: 1 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      hasTextFocus: () => false,
    };
    const rightEditor = {
      getVisibleRanges: () => [{ startLineNumber: 5, endLineNumber: 7 }],
      getTopForLineNumber: () => 50,
      getPosition: () => ({ lineNumber: 5 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      hasTextFocus: () => true,
    };

    const handled = handlePaneFocusShortcut(event, { leftEditor, rightEditor });

    expect(handled).toBe(true);
    expect(leftEditor.setPosition).toHaveBeenCalled();
  });

  it("focuses right on ctrl+k", () => {
    const event = createEvent({ ctrlKey: true, key: "k" });
    const leftEditor = {
      getVisibleRanges: () => [{ startLineNumber: 1, endLineNumber: 3 }],
      getTopForLineNumber: () => 50,
      getPosition: () => ({ lineNumber: 1 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      hasTextFocus: () => true,
    };
    const rightEditor = {
      getVisibleRanges: () => [{ startLineNumber: 5, endLineNumber: 7 }],
      getTopForLineNumber: () => 50,
      getPosition: () => ({ lineNumber: 5 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      hasTextFocus: () => false,
    };

    const handled = handlePaneFocusShortcut(event, { leftEditor, rightEditor });

    expect(handled).toBe(true);
    expect(rightEditor.setPosition).toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const event = createEvent({ ctrlKey: true, key: "x" });
    const leftEditor = {
      getVisibleRanges: () => [{ startLineNumber: 1, endLineNumber: 3 }],
      getTopForLineNumber: () => 50,
      getPosition: () => ({ lineNumber: 1 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      hasTextFocus: () => true,
    };
    const rightEditor = {
      getVisibleRanges: () => [{ startLineNumber: 5, endLineNumber: 7 }],
      getTopForLineNumber: () => 50,
      getPosition: () => ({ lineNumber: 5 }),
      setPosition: vi.fn(),
      focus: vi.fn(),
      hasTextFocus: () => false,
    };

    const handled = handlePaneFocusShortcut(event, { leftEditor, rightEditor });

    expect(handled).toBe(false);
    expect(leftEditor.setPosition).not.toHaveBeenCalled();
    expect(rightEditor.setPosition).not.toHaveBeenCalled();
  });
});
