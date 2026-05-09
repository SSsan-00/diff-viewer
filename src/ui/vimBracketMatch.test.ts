import { describe, expect, it, vi } from "vitest";
import {
  findMatchingBracketPosition,
  jumpToMatchingBracket,
} from "./vimBracketMatch";

function createEditor(lines: string[], position: { column: number; lineNumber: number }) {
  return {
    focus: vi.fn(),
    getModel: () => ({
      getLineContent: (lineNumber: number) => lines[lineNumber - 1] ?? "",
      getLineCount: () => lines.length,
    }),
    getPosition: () => position,
    revealPositionInCenterIfOutsideViewport: vi.fn(),
    setPosition: vi.fn(),
  };
}

describe("vim bracket matching", () => {
  it("jumps from an opening bracket to its matching closing bracket", () => {
    const editor = createEditor(["if (ready) {", "  call();", "}"], {
      lineNumber: 1,
      column: 12,
    });

    expect(findMatchingBracketPosition(editor)).toEqual({
      lineNumber: 3,
      column: 1,
    });
  });

  it("jumps from a closing bracket back to its matching opening bracket", () => {
    const editor = createEditor(["if (ready) {", "  call();", "}"], {
      lineNumber: 3,
      column: 1,
    });

    expect(findMatchingBracketPosition(editor)).toEqual({
      lineNumber: 1,
      column: 12,
    });
  });

  it("applies the resolved matching bracket position to the editor", () => {
    const editor = createEditor(["call(value);"], {
      lineNumber: 1,
      column: 11,
    });

    expect(jumpToMatchingBracket(editor)).toBe(true);
    expect(editor.setPosition).toHaveBeenCalledWith({
      lineNumber: 1,
      column: 5,
    });
    expect(editor.revealPositionInCenterIfOutsideViewport).toHaveBeenCalledWith({
      lineNumber: 1,
      column: 5,
    });
    expect(editor.focus).toHaveBeenCalled();
  });
});
