import { describe, expect, it, vi } from "vitest";
import { moveToViewportLine } from "./vimViewportMotion";

function createEditor(lines: string[], visible = { startLineNumber: 3, endLineNumber: 9 }) {
  return {
    focus: vi.fn(),
    getModel: () => ({
      getLineContent: (lineNumber: number) => lines[lineNumber - 1] ?? "",
      getLineCount: () => lines.length,
      getLineFirstNonWhitespaceColumn: (lineNumber: number) => {
        const match = (lines[lineNumber - 1] ?? "").match(/\S/);
        return match ? match.index! + 1 : 0;
      },
    }),
    getVisibleRanges: () => [visible],
    setPosition: vi.fn(),
  };
}

describe("vim viewport motions", () => {
  it("moves H to the first visible line", () => {
    const editor = createEditor([
      "one",
      "two",
      "    top",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ]);

    expect(moveToViewportLine(editor, "top")).toBe(true);
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 5 });
    expect(editor.focus).toHaveBeenCalled();
  });

  it("moves M to the middle visible line", () => {
    const editor = createEditor([
      "one",
      "two",
      "three",
      "four",
      "  middle",
      "six",
      "seven",
      "eight",
      "nine",
    ]);

    expect(moveToViewportLine(editor, "middle")).toBe(true);
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 6, column: 1 });
  });

  it("moves L to the last visible line", () => {
    const editor = createEditor([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "  bottom",
    ]);

    expect(moveToViewportLine(editor, "bottom")).toBe(true);
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 9, column: 3 });
  });

  it("uses column 1 for a blank target line", () => {
    const editor = createEditor(["one", "two", ""], {
      startLineNumber: 3,
      endLineNumber: 3,
    });

    expect(moveToViewportLine(editor, "top")).toBe(true);
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 1 });
  });
});
