import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { clearPaneMessage, setPaneMessage } from "./paneMessages";

describe("pane messages", () => {
  it("clears a message and error state", () => {
    const dom = new JSDOM("<div></div>");
    const target = dom.window.document.querySelector("div") as HTMLDivElement;

    setPaneMessage(target, "読み込み完了: A.txt", true);
    expect(target.textContent).toBe("読み込み完了: A.txt");
    expect(target.classList.contains("is-error")).toBe(true);

    clearPaneMessage(target);
    expect(target.textContent).toBe("");
    expect(target.classList.contains("is-error")).toBe(false);
  });
});
