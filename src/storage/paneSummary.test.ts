import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  clearPaneSummary,
  loadPaneSummary,
  savePaneSummary,
  type PaneSide,
} from "./paneSummary";

function createStorage() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test",
  });
  return dom.window.localStorage;
}

describe("pane summary storage", () => {
  it("saves and restores pane summaries", () => {
    const storage = createStorage();
    savePaneSummary(storage, "left", "読み込み完了: a.php");
    savePaneSummary(storage, "right", "読み込み完了: b.cs");

    expect(loadPaneSummary(storage, "left")).toBe("読み込み完了: a.php");
    expect(loadPaneSummary(storage, "right")).toBe("読み込み完了: b.cs");
  });

  it("clears pane summaries", () => {
    const storage = createStorage();
    const side: PaneSide = "left";
    savePaneSummary(storage, side, "読み込み完了: a.php");
    clearPaneSummary(storage, side);

    expect(loadPaneSummary(storage, side)).toBeNull();
  });

  it("handles storage errors gracefully", () => {
    const storage = {
      getItem: () => {
        throw new Error("fail");
      },
      setItem: () => {
        throw new Error("fail");
      },
      removeItem: () => {
        throw new Error("fail");
      },
    };

    expect(loadPaneSummary(storage, "left")).toBeNull();
    expect(() => savePaneSummary(storage, "left", "読み込み完了: a.php")).not.toThrow();
    expect(() => clearPaneSummary(storage, "left")).not.toThrow();
  });
});
