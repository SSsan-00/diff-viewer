import { describe, expect, it } from "vitest";
import { buildDecodedFiles, type DecodedFilesResult } from "../file/decodedFiles";
import {
  createAnchorAppendLineMapper,
  relocateAnchorLineForReload,
  type AnchorReloadPaneSnapshot,
} from "./anchorReload";

function buildSnapshot(
  files: readonly { name: string; text: string }[],
): AnchorReloadPaneSnapshot {
  const decoded: DecodedFilesResult = buildDecodedFiles(
    files.map((file) => ({
      name: file.name,
      bytes: new TextEncoder().encode(file.text),
    })),
    "utf-8",
  );
  return decoded;
}

describe("relocateAnchorLineForReload", () => {
  it("keeps the same file-local line when the file body is unchanged", () => {
    const previous = buildSnapshot([{ name: "a.txt", text: "same\nsame\ntail" }]);
    const next = buildSnapshot([{ name: "a.txt", text: "same\nsame\ntail" }]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "mapped",
      lineNo: 1,
    });
  });

  it("follows a unique unchanged line after an insertion before it", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "header\ntarget\ntail" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "header\ninserted\ntarget\ntail" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "mapped",
      lineNo: 2,
    });
  });

  it("follows a unique unchanged line after a deletion before it", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "header\nremoved\ntarget\ntail" },
    ]);
    const next = buildSnapshot([{ name: "a.txt", text: "header\ntarget\ntail" }]);

    expect(relocateAnchorLineForReload(2, previous, next)).toEqual({
      status: "mapped",
      lineNo: 1,
    });
  });

  it("uses unique surrounding context to distinguish repeated lines", () => {
    const previous = buildSnapshot([
      {
        name: "a.txt",
        text: "old start\nrepeat\nmiddle\nrepeat\nold end",
      },
    ]);
    const next = buildSnapshot([
      {
        name: "a.txt",
        text: "new start\ninserted\nrepeat\nmiddle\nrepeat\nnew end",
      },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "mapped",
      lineNo: 2,
    });
    expect(relocateAnchorLineForReload(3, previous, next)).toEqual({
      status: "mapped",
      lineNo: 4,
    });
  });

  it("maps a changed anchor line only when it is a one-to-one replacement hunk", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "repeat\ntarget\nrepeat" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "repeat\ntarget updated\nrepeat" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "mapped",
      lineNo: 1,
    });
  });

  it("maps a one-to-one replacement after identical duplicate context was consumed", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "target\nmarker\ntarget" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "target\nmarker\ntarget updated" },
    ]);

    expect(relocateAnchorLineForReload(2, previous, next)).toEqual({
      status: "mapped",
      lineNo: 2,
    });
  });

  it("does not guess within a multi-line replacement hunk", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "header\none\ntwo\ntail" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "header\nONE\nTWO\ntail" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "stale",
      reason: "line-changed-or-deleted",
    });
    expect(relocateAnchorLineForReload(2, previous, next)).toEqual({
      status: "stale",
      reason: "line-changed-or-deleted",
    });
  });

  it("keeps repeated lines stale when changed boundaries do not identify them", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "old\nrepeat\nrepeat\nold tail" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "new\nrepeat\nrepeat\nnew tail" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
    expect(relocateAnchorLineForReload(2, previous, next)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
  });

  it("uses a stable separator to identify the surviving repeated line", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "old\nrepeat\nmarker\nrepeat\nold tail" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "new\nmarker\nrepeat\nnew tail" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
    expect(relocateAnchorLineForReload(3, previous, next)).toEqual({
      status: "mapped",
      lineNo: 2,
    });
  });

  it("does not use crossing context to identify a repeated line", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "A\nrepeat\nB\nrepeat\nC" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "A\nrepeat\nrepeat\nB\nC" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "mapped",
      lineNo: 1,
    });
    expect(relocateAnchorLineForReload(3, previous, next)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
  });

  it("returns stale when the anchored line was deleted", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "header\ntarget\ntail" },
    ]);
    const deleted = buildSnapshot([{ name: "a.txt", text: "header\ntail" }]);

    expect(relocateAnchorLineForReload(1, previous, deleted)).toEqual({
      status: "stale",
      reason: "line-changed-or-deleted",
    });
  });

  it("does not guess which duplicate was inserted or deleted", () => {
    const previousDuplicate = buildSnapshot([
      { name: "a.txt", text: "header\ntarget\ntarget\ntail" },
    ]);
    const nextUnique = buildSnapshot([
      { name: "a.txt", text: "header\ninserted\ntarget\ntail" },
    ]);
    const previousUnique = buildSnapshot([
      { name: "a.txt", text: "header\ntarget\ntail" },
    ]);
    const nextDuplicate = buildSnapshot([
      { name: "a.txt", text: "header\ntarget\ntarget\ntail" },
    ]);

    expect(relocateAnchorLineForReload(1, previousDuplicate, nextUnique)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
    expect(relocateAnchorLineForReload(2, previousDuplicate, nextUnique)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
    expect(relocateAnchorLineForReload(1, previousUnique, nextDuplicate)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
  });

  it("does not choose between duplicate candidates without stable context", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "old header\ntarget\nold tail" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "new header\ntarget\ntarget\nnew tail" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "stale",
      reason: "ambiguous-line",
    });
  });

  it("does not map an anchored line into another file", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "A1\ntarget" },
      { name: "b.txt", text: "target\nB2" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "A1" },
      { name: "b.txt", text: "target\nB2" },
    ]);

    expect(relocateAnchorLineForReload(1, previous, next)).toEqual({
      status: "stale",
      reason: "line-changed-or-deleted",
    });
  });

  it("accounts for a preceding file segment growing", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "A1" },
      { name: "b.txt", text: "B1\ntarget\nB3" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "A0\nA1\nA2" },
      { name: "b.txt", text: "B1\ntarget\nB3" },
    ]);

    expect(relocateAnchorLineForReload(2, previous, next)).toEqual({
      status: "mapped",
      lineNo: 4,
    });
  });

  it("accounts for a preceding file segment shrinking", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "A0\nA1\nA2" },
      { name: "b.txt", text: "B1\ntarget\nB3" },
    ]);
    const next = buildSnapshot([
      { name: "a.txt", text: "A1" },
      { name: "b.txt", text: "B1\ntarget\nB3" },
    ]);

    expect(relocateAnchorLineForReload(4, previous, next)).toEqual({
      status: "mapped",
      lineNo: 2,
    });
  });

  it("returns stale when the same file segment is unavailable after reload", () => {
    const previous = buildSnapshot([{ name: "a.txt", text: "target" }]);
    const next = buildSnapshot([{ name: "b.txt", text: "target" }]);

    expect(relocateAnchorLineForReload(0, previous, next)).toEqual({
      status: "stale",
      reason: "file-unavailable",
    });
  });
});

describe("createAnchorAppendLineMapper", () => {
  it("keeps unchanged unmanaged lines but not the trailing empty append position", () => {
    const previous: AnchorReloadPaneSnapshot = {
      text: "manual\n",
      segments: [],
    };
    const next: AnchorReloadPaneSnapshot = {
      text: "manual\nA1",
      segments: [
        {
          startLine: 2,
          lineCount: 1,
          fileIndex: 1,
          fileName: "a.txt",
        },
      ],
    };
    const mapLine = createAnchorAppendLineMapper(previous, next);

    expect(mapLine(0)).toEqual({ status: "mapped", lineNo: 0 });
    expect(mapLine(1)).toMatchObject({ status: "stale" });
  });

  it("does not use absolute positions when an unmanaged line changed", () => {
    const mapLine = createAnchorAppendLineMapper(
      { text: "manual", segments: [] },
      {
        text: "changed\nA1",
        segments: [
          {
            startLine: 2,
            lineCount: 1,
            fileIndex: 1,
            fileName: "a.txt",
          },
        ],
      },
    );

    expect(mapLine(0)).toMatchObject({ status: "stale" });
  });
});
