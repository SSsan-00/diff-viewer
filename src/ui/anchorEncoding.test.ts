import { describe, expect, it } from "vitest";
import type { AnchorReloadPaneSnapshot } from "./anchorReload";
import { createAnchorEncodingLineMapper } from "./anchorEncoding";

function snapshot(
  text: string,
  segments: AnchorReloadPaneSnapshot["segments"],
): AnchorReloadPaneSnapshot {
  return { text, segments };
}

describe("createAnchorEncodingLineMapper", () => {
  it("keeps file-local rows when the same bytes decode to different text", () => {
    const previous = snapshot("譁�\n譁�\ntail", [
      {
        startLine: 1,
        lineCount: 3,
        fileIndex: 1,
        fileName: "sample.txt",
      },
    ]);
    const next = snapshot("日本語\n日本語\ntail", [
      {
        startLine: 1,
        lineCount: 3,
        fileIndex: 1,
        fileName: "sample.txt",
      },
    ]);
    const mapLine = createAnchorEncodingLineMapper(previous, next);

    expect(mapLine(0)).toEqual({ status: "mapped", lineNo: 0 });
    expect(mapLine(1)).toEqual({ status: "mapped", lineNo: 1 });
    expect(mapLine(2)).toEqual({ status: "mapped", lineNo: 2 });
  });

  it("maps through an absolute offset change while preserving the file-local row", () => {
    const previous = snapshot("A\ntarget\ntail", [
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "a.txt" },
      { startLine: 2, lineCount: 2, fileIndex: 2, fileName: "b.txt" },
    ]);
    const next = snapshot("pad\nA\ntarget\ntail", [
      { startLine: 2, lineCount: 1, fileIndex: 1, fileName: "a.txt" },
      { startLine: 3, lineCount: 2, fileIndex: 2, fileName: "b.txt" },
    ]);

    expect(createAnchorEncodingLineMapper(previous, next)(1)).toEqual({
      status: "mapped",
      lineNo: 2,
    });
  });

  it("does not map when the corresponding file or its line count changed", () => {
    const previous = snapshot("one\ntwo", [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "a.txt" },
    ]);
    const renamed = snapshot("one\ntwo", [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "b.txt" },
    ]);
    const resized = snapshot("one", [
      { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "a.txt" },
    ]);

    expect(createAnchorEncodingLineMapper(previous, renamed)(1)).toMatchObject({
      status: "stale",
    });
    expect(createAnchorEncodingLineMapper(previous, resized)(1)).toMatchObject({
      status: "stale",
    });
  });

  it("does not map an unmanaged, overlapping, or out-of-range row", () => {
    const unmanaged = snapshot("manual", []);
    const overlapping = snapshot("one\ntwo", [
      { startLine: 1, lineCount: 2, fileIndex: 1, fileName: "a.txt" },
      { startLine: 2, lineCount: 1, fileIndex: 2, fileName: "b.txt" },
    ]);

    expect(createAnchorEncodingLineMapper(unmanaged, unmanaged)(0)).toMatchObject({
      status: "stale",
    });
    expect(createAnchorEncodingLineMapper(overlapping, overlapping)(1)).toMatchObject({
      status: "stale",
    });
    expect(createAnchorEncodingLineMapper(overlapping, overlapping)(9)).toMatchObject({
      status: "stale",
    });
  });
});
