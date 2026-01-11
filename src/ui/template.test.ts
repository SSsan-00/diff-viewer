import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";

describe("pane action layout", () => {
  it("places the wrap toggle in the toolbar and removes pane toggles", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbar = doc.querySelector(".toolbar-right");
    const syncToggle = toolbar?.querySelector("#sync-toggle");
    const wrapToggle = toolbar?.querySelector("#wrap-toggle");
    const leftActions = doc.querySelector("#left-pane .pane-actions");
    const rightActions = doc.querySelector("#right-pane .pane-actions");

    const leftWrap = leftActions?.querySelector("#left-wrap");
    const leftClear = leftActions?.querySelector("#left-clear");
    const rightWrap = rightActions?.querySelector("#right-wrap");
    const rightClear = rightActions?.querySelector("#right-clear");

    expect(syncToggle).toBeTruthy();
    expect(wrapToggle).toBeTruthy();
    expect(leftWrap).toBeNull();
    expect(leftClear).toBeTruthy();
    expect(rightWrap).toBeNull();
    expect(rightClear).toBeTruthy();

    const toolbarChildren = Array.from(toolbar?.children ?? []);
    expect(toolbarChildren.indexOf(syncToggle!.closest(".toggle")!)).toBeLessThan(
      toolbarChildren.indexOf(wrapToggle!.closest(".toggle")!),
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

  it("uses a single wrap toggle in the toolbar", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbarToggle = doc.querySelector("#wrap-toggle");
    const paneToggles = doc.querySelectorAll("#left-wrap, #right-wrap");

    expect(toolbarToggle).toBeTruthy();
    expect(paneToggles.length).toBe(0);
  });

  it("adds a highlight toggle to the toolbar", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const highlightToggle = doc.querySelector("#highlight-toggle");

    expect(highlightToggle).toBeTruthy();
    expect(highlightToggle?.closest("label")?.classList.contains("toggle")).toBe(
      true,
    );
  });
});
