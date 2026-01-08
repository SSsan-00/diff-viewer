import { describe, expect, it } from "vitest";
import { buildAnchorDecorations } from "./anchorDecorations";

describe("buildAnchorDecorations", () => {
  it("uses glyph margin decorations at the line start", () => {
    const decorations = buildAnchorDecorations(
      [{ leftLineNo: 2, rightLineNo: 4 }],
      null,
      (line, startColumn, endColumn) => ({
        startLineNumber: line,
        startColumn,
        endLineNumber: line,
        endColumn,
      }),
    );

    const glyphs = decorations.left.filter(
      (decoration) => decoration.options.glyphMarginClassName,
    );
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0].options.isWholeLine).toBeUndefined();
    expect(glyphs[0].range.startColumn).toBe(1);
    expect(glyphs[0].range.endColumn).toBe(2);
  });
});
