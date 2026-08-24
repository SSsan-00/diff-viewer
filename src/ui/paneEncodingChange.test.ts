import { describe, expect, it, vi } from "vitest";
import { buildDecodedFiles, type FileBytes } from "../file/decodedFiles";
import type { FileEncoding } from "../file/decode";
import { createPaneEncodingChangeController } from "./paneEncodingChange";

describe("pane encoding change", () => {
  it("restores the last successfully applied encoding after invalid UTF-8", () => {
    const rawFiles: FileBytes[] = [
      { name: "invalid.txt", bytes: new Uint8Array([0xc3, 0x28]) },
    ];
    const state = {
      text: "before",
      segments: [
        { startLine: 1, lineCount: 1, fileIndex: 1, fileName: "invalid.txt" },
      ],
      rawFiles,
      anchors: [{ leftLineNo: 0, rightLineNo: 0 }],
    };
    const before = structuredClone(state);
    let selectedEncoding: FileEncoding = "utf-8";
    const restoreSelection = vi.fn((encoding: FileEncoding) => {
      selectedEncoding = encoding;
    });
    const refreshControls = vi.fn();
    const commit = vi.fn();
    const controller = createPaneEncodingChangeController<FileEncoding>("auto");

    const result = controller.apply("utf-8", {
      prepare: (encoding) => buildDecodedFiles(rawFiles, encoding),
      commit,
      restoreSelection,
      refreshControls,
    });

    expect(result.status).toBe("prepare-failed");
    expect(controller.getAppliedValue()).toBe("auto");
    expect(selectedEncoding).toBe("auto");
    expect(restoreSelection).toHaveBeenCalledWith("auto");
    expect(refreshControls).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it("restores the most recent successful value when anchor preparation fails", () => {
    let selectedEncoding: FileEncoding = "shift_jis";
    const refreshControls = vi.fn();
    const commit = vi.fn();
    const controller = createPaneEncodingChangeController<FileEncoding>("auto");

    expect(
      controller.apply("shift_jis", {
        prepare: () => "prepared",
        commit,
        restoreSelection: (encoding) => {
          selectedEncoding = encoding;
        },
        refreshControls,
      }).status,
    ).toBe("committed");

    selectedEncoding = "utf-8";
    const result = controller.apply("utf-8", {
      prepare: () => {
        throw new Error("anchor mapping failed");
      },
      commit,
      restoreSelection: (encoding) => {
        selectedEncoding = encoding;
      },
      refreshControls,
    });

    expect(result).toMatchObject({
      status: "prepare-failed",
      appliedValue: "shift_jis",
    });
    expect(controller.getAppliedValue()).toBe("shift_jis");
    expect(selectedEncoding).toBe("shift_jis");
    expect(commit).toHaveBeenCalledOnce();
    expect(refreshControls).toHaveBeenCalledTimes(2);
  });
});
