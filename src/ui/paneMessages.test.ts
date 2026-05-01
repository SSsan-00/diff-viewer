import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { clearPaneMessage, setPaneMessage, syncPaneMessages } from "./paneMessages";

function setScrollHeight(target: HTMLElement, value: number): void {
  Object.defineProperty(target, "scrollHeight", {
    configurable: true,
    get: () => value,
  });
}

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

  it("hides both message rows when neither pane has a message", () => {
    const dom = new JSDOM("<div id=\"left\"></div><div id=\"right\"></div>");
    const left = dom.window.document.querySelector("#left") as HTMLDivElement;
    const right = dom.window.document.querySelector("#right") as HTMLDivElement;

    syncPaneMessages(left, right);

    expect(left.style.display).toBe("none");
    expect(right.style.display).toBe("none");
    expect(left.style.minHeight).toBe("0px");
    expect(right.style.minHeight).toBe("0px");
  });

  it("reserves the same height on both panes when one side has a message", () => {
    const dom = new JSDOM("<div id=\"left\"></div><div id=\"right\"></div>");
    const left = dom.window.document.querySelector("#left") as HTMLDivElement;
    const right = dom.window.document.querySelector("#right") as HTMLDivElement;

    setPaneMessage(left, "左だけメッセージ", true);
    setScrollHeight(left, 28);
    setScrollHeight(right, 0);

    syncPaneMessages(left, right);

    expect(left.style.display).toBe("block");
    expect(right.style.display).toBe("block");
    expect(left.style.minHeight).toBe("28px");
    expect(right.style.minHeight).toBe("28px");
  });

  it("uses the taller message height when both panes have messages", () => {
    const dom = new JSDOM("<div id=\"left\"></div><div id=\"right\"></div>");
    const left = dom.window.document.querySelector("#left") as HTMLDivElement;
    const right = dom.window.document.querySelector("#right") as HTMLDivElement;

    setPaneMessage(left, "短い", false);
    setPaneMessage(right, "長いメッセージ", true);
    setScrollHeight(left, 20);
    setScrollHeight(right, 44);

    syncPaneMessages(left, right);

    expect(left.style.minHeight).toBe("44px");
    expect(right.style.minHeight).toBe("44px");
    expect(right.classList.contains("is-error")).toBe(true);
  });
});
