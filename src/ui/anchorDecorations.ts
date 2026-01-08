import type { Anchor } from "../diffEngine/anchors";

export type RangeLike = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type RangeFactory = (line: number, startColumn: number, endColumn: number) => RangeLike;

export type DecorationPair = {
  left: Array<{
    range: RangeLike;
    options: {
      isWholeLine?: boolean;
      className?: string;
      glyphMarginClassName?: string;
    };
  }>;
  right: Array<{
    range: RangeLike;
    options: {
      isWholeLine?: boolean;
      className?: string;
      glyphMarginClassName?: string;
    };
  }>;
};

function pushAnchorDecorations(
  target: DecorationPair,
  anchor: Anchor,
  lineClass: string,
  glyphClass: string,
  createRange: RangeFactory,
) {
  const leftLine = anchor.leftLineNo + 1;
  const rightLine = anchor.rightLineNo + 1;

  target.left.push({
    range: createRange(leftLine, 1, 1),
    options: { isWholeLine: true, className: lineClass },
  });
  target.right.push({
    range: createRange(rightLine, 1, 1),
    options: { isWholeLine: true, className: lineClass },
  });

  target.left.push({
    range: createRange(leftLine, 1, 2),
    options: { glyphMarginClassName: glyphClass },
  });
  target.right.push({
    range: createRange(rightLine, 1, 2),
    options: { glyphMarginClassName: glyphClass },
  });
}

export function buildAnchorDecorations(
  validAnchors: Anchor[],
  autoAnchorTarget: Anchor | null,
  createRange: RangeFactory,
): DecorationPair {
  const decorations: DecorationPair = { left: [], right: [] };

  validAnchors.forEach((anchor) => {
    pushAnchorDecorations(
      decorations,
      anchor,
      "diff-anchor-line",
      "diff-anchor-glyph",
      createRange,
    );
  });

  if (autoAnchorTarget) {
    pushAnchorDecorations(
      decorations,
      autoAnchorTarget,
      "diff-anchor-auto-line",
      "diff-anchor-auto-glyph",
      createRange,
    );
  }

  return decorations;
}
