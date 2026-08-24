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

  it("returns stale when the anchored line was changed or deleted", () => {
    const previous = buildSnapshot([
      { name: "a.txt", text: "header\ntarget\ntail" },
    ]);
    const changed = buildSnapshot([
      { name: "a.txt", text: "header\ntarget changed\ntail" },
    ]);
    const deleted = buildSnapshot([{ name: "a.txt", text: "header\ntail" }]);

    expect(relocateAnchorLineForReload(1, previous, changed)).toEqual({
      status: "stale",
      reason: "line-changed-or-deleted",
    });
    expect(relocateAnchorLineForReload(1, previous, deleted)).toEqual({
      status: "stale",
      reason: "line-changed-or-deleted",
    });
  });

  it("returns stale instead of guessing when the anchored line is duplicated", () => {
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
    expect(relocateAnchorLineForReload(1, previousUnique, nextDuplicate)).toEqual({
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
