import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";

describe("pane action layout", () => {
  it("places the wrap toggle to the left of the clear button", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftActions = doc.querySelector("#left-pane .pane-actions");
    const rightActions = doc.querySelector("#right-pane .pane-actions");

    const leftWrap = leftActions?.querySelector("#left-wrap");
    const leftClear = leftActions?.querySelector("#left-clear");
    const rightWrap = rightActions?.querySelector("#right-wrap");
    const rightClear = rightActions?.querySelector("#right-clear");

    expect(leftWrap).toBeTruthy();
    expect(leftClear).toBeTruthy();
    expect(rightWrap).toBeTruthy();
    expect(rightClear).toBeTruthy();

    const leftChildren = Array.from(leftActions?.children ?? []);
    const rightChildren = Array.from(rightActions?.children ?? []);

    expect(leftChildren.indexOf(leftWrap!.closest(".toggle")!)).toBeLessThan(
      leftChildren.indexOf(leftClear!),
    );
    expect(rightChildren.indexOf(rightWrap!.closest(".toggle")!)).toBeLessThan(
      rightChildren.indexOf(rightClear!),
    );
  });

  it("renders encoding labels with a dedicated class", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftLabel = doc.querySelector(
      "#left-pane .pane-select .pane-select-label",
    );
    const rightLabel = doc.querySelector(
      "#right-pane .pane-select .pane-select-label",
    );

    expect(leftLabel?.textContent).toBe("文字コード");
    expect(rightLabel?.textContent).toBe("文字コード");
  });
});
