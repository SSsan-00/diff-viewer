import { describe, expect, it } from "vitest";
import type { Anchor } from "../diffEngine/anchors";
import type { LineSegment } from "../file/lineNumbering";
import {
  buildAnchorTransferPayload,
  resolveImportedAnchors,
} from "./anchorTransfer";

describe("anchor transfer", () => {
  const leftSegments: LineSegment[] = [
    { startLine: 1, lineCount: 5, fileIndex: 1, fileName: "left.html" },
  ];
  const rightSegments: LineSegment[] = [
    { startLine: 1, lineCount: 4, fileIndex: 1, fileName: "head.html" },
    { startLine: 5, lineCount: 6, fileIndex: 2, fileName: "body.html" },
  ];

  it("exports manual anchors as file-local 1-based line numbers", () => {
    const anchors: Anchor[] = [{ leftLineNo: 2, rightLineNo: 6 }];

    const payload = buildAnchorTransferPayload(anchors, {
      leftSegments,
      rightSegments,
    });

    expect(payload).toEqual({
      kind: "diff-viewer-anchors",
      version: 1,
      panes: {
        left: { files: 1 },
        right: { files: 2 },
      },
      anchors: [
        {
          left: { file: 1, line: 3 },
          right: { file: 2, line: 3 },
        },
      ],
    });
  });

  it("imports anchors with swapped panes when current file counts are reversed", () => {
    const payload = buildAnchorTransferPayload(
      [{ leftLineNo: 2, rightLineNo: 6 }],
      { leftSegments, rightSegments },
    );

    const result = resolveImportedAnchors(payload, {
      leftSegments: rightSegments,
      rightSegments: leftSegments,
      leftLineCount: 10,
      rightLineCount: 5,
    });

    expect(result).toEqual({
      ok: true,
      swapped: true,
      anchors: [{ leftLineNo: 6, rightLineNo: 2 }],
    });
  });

  it("rejects imports that cannot be resolved against the current file layout", () => {
    const payload = buildAnchorTransferPayload(
      [{ leftLineNo: 2, rightLineNo: 6 }],
      { leftSegments, rightSegments },
    );

    const result = resolveImportedAnchors(payload, {
      leftSegments,
      rightSegments: [{ startLine: 1, lineCount: 4, fileIndex: 1 }],
      leftLineCount: 5,
      rightLineCount: 4,
    });

    expect(result.ok).toBe(false);
  });

  it("uses the editor line when the file-local segment count is shorter than the current content", () => {
    const payload = {
      kind: "diff-viewer-anchors",
      version: 1,
      panes: {
        left: { files: 1 },
        right: { files: 1 },
      },
      anchors: [
        {
          left: { file: 1, line: 8 },
          right: { file: 1, line: 9 },
        },
      ],
    };

    const result = resolveImportedAnchors(payload, {
      leftSegments: [{ startLine: 1, lineCount: 5, fileIndex: 1 }],
      rightSegments: [{ startLine: 1, lineCount: 5, fileIndex: 1 }],
      leftLineCount: 10,
      rightLineCount: 10,
    });

    expect(result).toEqual({
      ok: true,
      swapped: false,
      anchors: [{ leftLineNo: 7, rightLineNo: 8 }],
    });
  });
});
