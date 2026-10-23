import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { clearPaneSummary } from "./paneSummary";

describe("legacy pane summary cleanup", () => {
  it("clears only the requested pane's legacy summary", () => {
    const storage = new JSDOM("", { url: "https://example.test" }).window.localStorage;
    const leftKey = "diff-viewer:paneMessageSummary:v1:left";
    const rightKey = "diff-viewer:paneMessageSummary:v1:right";
    storage.setItem(leftKey, "a.php");
    storage.setItem(rightKey, "b.cs");

    clearPaneSummary(storage, "left");

    expect(storage.getItem(leftKey)).toBeNull();
    expect(storage.getItem(rightKey)).toBe("b.cs");
  });

  it("handles unavailable storage and removal failures", () => {
    expect(() => clearPaneSummary(null, "left")).not.toThrow();
    const storage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => { throw new Error("fail"); },
    };
    expect(() => clearPaneSummary(storage, "left")).not.toThrow();
  });
});
