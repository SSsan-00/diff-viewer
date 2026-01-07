import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";
import { bindPaneClearButton } from "./paneClear";
import type { LineSegment } from "../file/lineNumbering";

function setupDocument(): Document {
  return new JSDOM(APP_TEMPLATE).window.document;
}

describe("pane clear buttons", () => {
  it("clears only the left pane", () => {
    const document = setupDocument();
    const leftButton = document.querySelector<HTMLButtonElement>("#left-clear");
    const rightButton = document.querySelector<HTMLButtonElement>("#right-clear");

    const leftEditor = {
      value: "left",
      setValue(value: string) {
        leftEditor.value = value;
      },
    };
    const rightEditor = {
      value: "right",
      setValue(value: string) {
        rightEditor.value = value;
      },
    };

    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];
    const rightSegments: LineSegment[] = [
      { startLine: 1, lineCount: 3, fileIndex: 1 },
    ];

    const updateLeft = vi.fn();
    const updateRight = vi.fn();
    const afterLeft = vi.fn();
    const afterRight = vi.fn();

    bindPaneClearButton(leftButton, {
      editor: leftEditor,
      segments: leftSegments,
      updateLineNumbers: updateLeft,
      onAfterClear: afterLeft,
    });
    bindPaneClearButton(rightButton, {
      editor: rightEditor,
      segments: rightSegments,
      updateLineNumbers: updateRight,
      onAfterClear: afterRight,
    });

    leftButton?.click();

    expect(leftEditor.value).toBe("");
    expect(rightEditor.value).toBe("right");
    expect(leftSegments.length).toBe(0);
    expect(rightSegments.length).toBe(1);
    expect(updateLeft).toHaveBeenCalledTimes(1);
    expect(updateRight).not.toHaveBeenCalled();
    expect(afterLeft).toHaveBeenCalledTimes(1);
    expect(afterRight).not.toHaveBeenCalled();
  });

  it("clears only the right pane", () => {
    const document = setupDocument();
    const leftButton = document.querySelector<HTMLButtonElement>("#left-clear");
    const rightButton = document.querySelector<HTMLButtonElement>("#right-clear");

    const leftEditor = {
      value: "left",
      setValue(value: string) {
        leftEditor.value = value;
      },
    };
    const rightEditor = {
      value: "right",
      setValue(value: string) {
        rightEditor.value = value;
      },
    };

    const leftSegments: LineSegment[] = [
      { startLine: 1, lineCount: 2, fileIndex: 1 },
    ];
    const rightSegments: LineSegment[] = [
      { startLine: 1, lineCount: 3, fileIndex: 1 },
    ];

    const updateLeft = vi.fn();
    const updateRight = vi.fn();
    const afterLeft = vi.fn();
    const afterRight = vi.fn();

    bindPaneClearButton(leftButton, {
      editor: leftEditor,
      segments: leftSegments,
      updateLineNumbers: updateLeft,
      onAfterClear: afterLeft,
    });
    bindPaneClearButton(rightButton, {
      editor: rightEditor,
      segments: rightSegments,
      updateLineNumbers: updateRight,
      onAfterClear: afterRight,
    });

    rightButton?.click();

    expect(rightEditor.value).toBe("");
    expect(leftEditor.value).toBe("left");
    expect(rightSegments.length).toBe(0);
    expect(leftSegments.length).toBe(1);
    expect(updateRight).toHaveBeenCalledTimes(1);
    expect(updateLeft).not.toHaveBeenCalled();
    expect(afterRight).toHaveBeenCalledTimes(1);
    expect(afterLeft).not.toHaveBeenCalled();
  });
});
