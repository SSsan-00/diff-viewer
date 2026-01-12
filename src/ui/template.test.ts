import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";

describe("pane action layout", () => {
  it("places the diff-only toggle in the toolbar and removes pane toggles", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbar = doc.querySelector(".toolbar-right");
    const syncToggle = toolbar?.querySelector("#sync-toggle");
    const wrapToggle = toolbar?.querySelector("#wrap-toggle");
    const foldToggle = toolbar?.querySelector("#fold-toggle");
    const leftActions = doc.querySelector("#left-pane .pane-actions");
    const rightActions = doc.querySelector("#right-pane .pane-actions");

    const leftWrap = leftActions?.querySelector("#left-wrap");
    const leftClear = leftActions?.querySelector("#left-clear");
    const rightWrap = rightActions?.querySelector("#right-wrap");
    const rightClear = rightActions?.querySelector("#right-clear");

    expect(syncToggle).toBeTruthy();
    expect(wrapToggle).toBeNull();
    expect(foldToggle).toBeTruthy();
    expect(leftWrap).toBeNull();
    expect(leftClear).toBeTruthy();
    expect(rightWrap).toBeNull();
    expect(rightClear).toBeTruthy();

    const toolbarChildren = Array.from(toolbar?.children ?? []);
    expect(toolbarChildren.indexOf(syncToggle!.closest(".toggle")!)).toBeLessThan(
      toolbarChildren.indexOf(foldToggle!.closest(".toggle")!),
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

  it("does not render a wrap toggle in the toolbar", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbarToggle = doc.querySelector("#wrap-toggle");
    const paneToggles = doc.querySelectorAll("#left-wrap, #right-wrap");

    expect(toolbarToggle).toBeNull();
    expect(paneToggles.length).toBe(0);
  });

  it("renders the diff-only toggle label in the toolbar", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    expect(doc.body.textContent).not.toContain("折り返し");
    expect(doc.body.textContent).not.toContain("差分なしの箇所を折りたたみ");
    expect(doc.body.textContent).toContain("差分のみ表示");
    expect(doc.querySelector("#fold-toggle")).toBeTruthy();
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

  it("renders the theme toggle as a switch with sun and moon icons", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const themeToggle = doc.querySelector<HTMLInputElement>("#theme-toggle");
    const themeLabel = themeToggle?.closest("label");
    const sun = doc.querySelector(".theme-switch__sun");
    const moon = doc.querySelector(".theme-switch__moon");
    const sunSvg = doc.querySelector("#sun");
    const moonSvg = doc.querySelector("#moon");
    const track = doc.querySelector(".theme-switch__track");

    expect(themeToggle).toBeTruthy();
    expect(themeToggle?.getAttribute("role")).toBe("switch");
    expect(themeToggle?.getAttribute("aria-label")).toBe("テーマ");
    expect(themeToggle?.getAttribute("aria-checked")).toBe("false");
    expect(themeLabel?.classList.contains("theme-switch")).toBe(true);
    expect(track).toBeTruthy();
    expect(sun).toBeTruthy();
    expect(moon).toBeTruthy();
    expect(sunSvg).toBeTruthy();
    expect(moonSvg).toBeTruthy();
  });

  it("adds a dedicated class to the app title", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const title = doc.querySelector(".title");

    expect(title?.classList.contains("app-title")).toBe(true);
    expect(title?.textContent).toBe("Diff Viewer");
  });
});
