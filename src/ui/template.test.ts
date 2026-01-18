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

  it("does not render encoding labels but keeps the select", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftLabel = doc.querySelector("#left-pane .pane-select-label");
    const rightLabel = doc.querySelector("#right-pane .pane-select-label");
    const leftSelect = doc.querySelector("#left-pane .pane-select select");
    const rightSelect = doc.querySelector("#right-pane .pane-select select");

    expect(leftLabel).toBeNull();
    expect(rightLabel).toBeNull();
    expect(leftSelect).toBeTruthy();
    expect(rightSelect).toBeTruthy();
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
    expect(title?.textContent?.trim()).toBe("Workspace");
  });

  it("renders file card bars for both panes", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftBar = doc.querySelector("#left-file-cards");
    const rightBar = doc.querySelector("#right-file-cards");

    expect(leftBar).toBeTruthy();
    expect(rightBar).toBeTruthy();
    expect(leftBar?.classList.contains("file-cards-bar")).toBe(true);
    expect(rightBar?.classList.contains("file-cards-bar")).toBe(true);
    expect(leftBar?.classList.contains("file-cards-bar--horizontal")).toBe(
      true,
    );
  });

  it("renders favorite path controls for both panes", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftButton = doc.querySelector("#left-favorite-add");
    const rightButton = doc.querySelector("#right-favorite-add");
    const leftBar = doc.querySelector("#left-favorite-paths");
    const rightBar = doc.querySelector("#right-favorite-paths");

    expect(leftButton).toBeTruthy();
    expect(rightButton).toBeTruthy();
    expect(leftBar).toBeTruthy();
    expect(rightBar).toBeTruthy();
    expect(leftBar?.classList.contains("favorite-paths-list")).toBe(true);
    expect(rightBar?.classList.contains("favorite-paths-list")).toBe(true);
  });

  it("renders workspace controls in the toolbar", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toggle = doc.querySelector("#workspace-toggle");
    const panel = doc.querySelector("#workspace-panel");
    const list = doc.querySelector("#workspace-list");
    const create = doc.querySelector("#workspace-create");
    const overlay = doc.querySelector("#workspace-overlay");

    expect(toggle).toBeTruthy();
    expect(panel).toBeTruthy();
    expect(list).toBeTruthy();
    expect(create).toBeTruthy();
    expect(overlay).toBeTruthy();
  });

  it("does not render favorite panel close buttons", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftClose = doc.querySelector("#left-favorite-close");
    const rightClose = doc.querySelector("#right-favorite-close");

    expect(leftClose).toBeNull();
    expect(rightClose).toBeNull();
  });

  it("renders goto line panels for both panes", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const leftPanel = doc.querySelector("#left-goto-line");
    const rightPanel = doc.querySelector("#right-goto-line");
    const leftInput = doc.querySelector("#left-goto-line-input");
    const rightInput = doc.querySelector("#right-goto-line-input");

    expect(leftPanel).toBeTruthy();
    expect(rightPanel).toBeTruthy();
    expect(leftPanel?.classList.contains("goto-line-panel")).toBe(true);
    expect(rightPanel?.classList.contains("goto-line-panel")).toBe(true);
    expect(leftInput).toBeTruthy();
    expect(rightInput).toBeTruthy();
  });
});
