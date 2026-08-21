import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import type { PairedOp } from "../diffEngine/types";
import { diffWithAnchors, type Anchor } from "../diffEngine/anchors";
import { copyText } from "./clipboard";
import {
  bindPaneSourceCopyButton,
  buildCopyTextFromVisualRows,
  buildCopyVisualRowsFromAlignedDiff,
} from "./paneSourceCopy";

describe("buildCopyVisualRowsFromAlignedDiff", () => {
  it("keeps gap rows as empty strings on the opposite side", () => {
    const ops: PairedOp[] = [
      { type: "equal", leftLine: "a", rightLine: "a", leftLineNo: 0, rightLineNo: 0 },
      { type: "insert", rightLine: "x", rightLineNo: 1 },
      { type: "delete", leftLine: "y", leftLineNo: 1 },
      { type: "equal", leftLine: "b", rightLine: "b", leftLineNo: 2, rightLineNo: 2 },
    ];
    const rows = buildCopyVisualRowsFromAlignedDiff(ops);

    expect(rows).toEqual([
      { kind: "equal", leftText: "a", rightText: "a" },
      { kind: "insert", leftText: "", leftVirtual: true, rightText: "x" },
      { kind: "delete", leftText: "y", rightText: "", rightVirtual: true },
      { kind: "equal", leftText: "b", rightText: "b" },
    ]);
    expect(buildCopyTextFromVisualRows(rows, "left")).toBe("a\n\ny\nb\n");
    expect(buildCopyTextFromVisualRows(rows, "right")).toBe("a\nx\n\nb\n");
  });

  it("keeps the same row count as anchored aligned rows", () => {
    const left = "A\nB\nC";
    const right = "A\nX\nB\nC";
    const anchors: Anchor[] = [{ leftLineNo: 2, rightLineNo: 3 }];
    const ops = diffWithAnchors(left, right, anchors);
    const rows = buildCopyVisualRowsFromAlignedDiff(ops);

    expect(rows).toHaveLength(ops.length);
    expect(rows[1]).toEqual({
      kind: "insert",
      leftText: "",
      leftVirtual: true,
      rightText: "X",
    });
  });

  it("includes file boundary zone labels and gap lines in the copied rows", () => {
    const ops: PairedOp[] = [
      { type: "equal", leftLine: "file1-a", rightLine: "file1-a", leftLineNo: 0, rightLineNo: 0 },
      { type: "equal", leftLine: "file2-a", rightLine: "file2-a", leftLineNo: 1, rightLineNo: 1 },
    ];
    const rows = buildCopyVisualRowsFromAlignedDiff(ops, {
      left: [
        {
          afterLineNumber: 1,
          heightInLines: 2,
          className: "file-boundary-zone",
          label: "File 2: left.cs",
        },
      ],
      right: [
        {
          afterLineNumber: 1,
          heightInLines: 2,
          className: "file-boundary-zone",
          label: "File 2: right.php",
        },
      ],
    });

    expect(rows).toEqual([
      { kind: "equal", leftText: "file1-a", rightText: "file1-a" },
      {
        diffVisible: false,
        kind: "equal",
        leftText: "File 2: left.cs",
        leftVirtual: true,
        rightText: "File 2: right.php",
        rightVirtual: true,
      },
      {
        diffVisible: false,
        kind: "equal",
        leftText: "",
        leftVirtual: true,
        rightText: "",
        rightVirtual: true,
      },
      { kind: "equal", leftText: "file2-a", rightText: "file2-a" },
    ]);
  });

  it("preserves empty source lines separately from virtual gap cells", () => {
    const rows = buildCopyVisualRowsFromAlignedDiff([
      { type: "insert", rightLine: "", rightLineNo: 0 },
      { type: "delete", leftLine: "", leftLineNo: 0 },
      {
        type: "replace",
        diffVisible: false,
        leftLine: "left",
        rightLine: "right",
        leftLineNo: 1,
        rightLineNo: 1,
      },
    ]);

    expect(rows).toEqual([
      { kind: "insert", leftText: "", leftVirtual: true, rightText: "" },
      { kind: "delete", leftText: "", rightText: "", rightVirtual: true },
      {
        diffVisible: false,
        kind: "replace",
        leftText: "left",
        rightText: "right",
      },
    ]);
  });

  it("builds boundary line numbers with linear indexed reads", () => {
    const source: PairedOp[] = Array.from({ length: 400 }, (_, index) => ({
      type: index % 3 === 0 ? "insert" : index % 3 === 1 ? "delete" : "equal",
      leftLine: `left-${index}`,
      rightLine: `right-${index}`,
    }));
    let indexedReads = 0;
    const ops = new Proxy(source, {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) {
          indexedReads += 1;
        }
        return Reflect.get(target, property, receiver);
      },
    });

    buildCopyVisualRowsFromAlignedDiff(ops, {
      left: [{ afterLineNumber: 100, label: "left-boundary" }],
      right: [{ afterLineNumber: 100, label: "right-boundary" }],
    });

    expect(indexedReads).toBeLessThan(source.length * 10);
  });
});

describe("bindPaneSourceCopyButton", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("copies left pane text on click", async () => {
    const dom = new JSDOM(`<button id="left-copy">ソースコピー</button>`);
    const button = dom.window.document.querySelector<HTMLButtonElement>("#left-copy");
    const toast = { show: vi.fn() };
    const rows = [
      { leftText: "L1", rightText: "R1" },
      { leftText: "", rightText: "R2" },
    ];
    const expected = buildCopyTextFromVisualRows(rows, "left");

    bindPaneSourceCopyButton({
      button,
      side: "left",
      doc: dom.window.document,
      copy: copyText,
      toast,
      getText: () => expected,
    });

    button?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expected);
    expect(toast.show).toHaveBeenCalledWith("左ペインのソースをコピーしました。");
  });

  it("copies right pane text on click", async () => {
    const dom = new JSDOM(`<button id="right-copy">ソースコピー</button>`);
    const button = dom.window.document.querySelector<HTMLButtonElement>("#right-copy");
    const toast = { show: vi.fn() };
    const rows = [{ leftText: "L1", rightText: "R1" }];
    const expected = buildCopyTextFromVisualRows(rows, "right");

    bindPaneSourceCopyButton({
      button,
      side: "right",
      doc: dom.window.document,
      copy: copyText,
      toast,
      getText: () => expected,
    });

    button?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expected);
    expect(toast.show).toHaveBeenCalledWith("右ペインのソースをコピーしました。");
  });
});
