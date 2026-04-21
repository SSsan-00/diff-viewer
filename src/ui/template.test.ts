import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE, createAppTemplate } from "./template";

describe("pane action layout", () => {
  it("renders no-save controls by default", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;
    const leftReload = doc.querySelector<HTMLButtonElement>("#left-reload-file");
    const rightReload = doc.querySelector<HTMLButtonElement>("#right-reload-file");

    expect(doc.querySelector(".app")?.getAttribute("data-writeback")).toBe("off");
    expect(doc.querySelector<HTMLButtonElement>("#left-save-file")?.hidden).toBe(true);
    expect(doc.querySelector<HTMLButtonElement>("#right-save-file")?.hidden).toBe(true);
    expect(leftReload).toBeTruthy();
    expect(rightReload).toBeTruthy();
    expect(leftReload?.hidden).toBe(false);
    expect(rightReload?.hidden).toBe(false);
    expect(leftReload?.hasAttribute("aria-hidden")).toBe(false);
    expect(rightReload?.hasAttribute("aria-hidden")).toBe(false);
    expect(leftReload?.disabled).toBe(true);
    expect(rightReload?.disabled).toBe(true);
  });

  it("can render a writeback screen with save controls visible", () => {
    const dom = new JSDOM(createAppTemplate({ writebackEnabled: true }));
    const doc = dom.window.document;
    const leftSave = doc.querySelector<HTMLButtonElement>("#left-save-file");
    const rightSave = doc.querySelector<HTMLButtonElement>("#right-save-file");
    const leftReload = doc.querySelector<HTMLButtonElement>("#left-reload-file");
    const rightReload = doc.querySelector<HTMLButtonElement>("#right-reload-file");

    expect(doc.querySelector(".app")?.getAttribute("data-writeback")).toBe("on");
    expect(leftSave).toBeTruthy();
    expect(rightSave).toBeTruthy();
    expect(leftReload).toBeTruthy();
    expect(rightReload).toBeTruthy();
    expect(leftSave?.hidden).toBe(false);
    expect(rightSave?.hidden).toBe(false);
    expect(leftReload?.hidden).toBe(false);
    expect(rightReload?.hidden).toBe(false);
    expect(leftSave?.hasAttribute("aria-hidden")).toBe(false);
    expect(rightSave?.hasAttribute("aria-hidden")).toBe(false);
    expect(leftReload?.hasAttribute("aria-hidden")).toBe(false);
    expect(rightReload?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("removes recalc button and adds export report button in toolbar", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbar = doc.querySelector(".toolbar-right");
    const recalcButton = toolbar?.querySelector("#recalc");
    const exportButton = toolbar?.querySelector("#export-report");
    const modeTrigger = toolbar?.querySelector("#report-mode-toggle");
    const modeMenu = toolbar?.querySelector("#report-mode-menu");
    const modeSimple = toolbar?.querySelector("#report-mode-simple");
    const modeRich = toolbar?.querySelector("#report-mode-rich");
    const exportControl = toolbar?.querySelector(".report-export-control");
    const toolbarChildren = Array.from(toolbar?.children ?? []);
    const diffPrev = toolbar?.querySelector("#diff-prev");

    expect(recalcButton).toBeNull();
    expect(exportButton).toBeTruthy();
    expect(exportButton?.textContent?.trim()).toBe("レポート出力");
    expect(modeTrigger).toBeTruthy();
    expect(modeTrigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(modeMenu).toBeTruthy();
    expect(modeMenu?.getAttribute("role")).toBe("menu");
    expect(modeSimple).toBeTruthy();
    expect(modeRich).toBeTruthy();
    expect(modeSimple?.textContent?.trim()).toBe("シンプル");
    expect(modeRich?.textContent?.trim()).toBe("リッチ");
    expect(exportControl).toBeTruthy();
    expect(toolbarChildren.indexOf(exportControl!)).toBeLessThan(
      toolbarChildren.indexOf(diffPrev!),
    );
  });

  it("places the diff-only toggle in the toolbar and removes pane toggles", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbar = doc.querySelector(".toolbar-right");
    const syncToggle = toolbar?.querySelector("#sync-toggle");
    const ignoreLeadingWhitespaceToggle = toolbar?.querySelector(
      "#ignore-leading-whitespace-toggle",
    );
    const wrapToggle = toolbar?.querySelector("#wrap-toggle");
    const foldToggle = toolbar?.querySelector("#fold-toggle");
    const leftActions = doc.querySelector("#left-pane .pane-actions");
    const rightActions = doc.querySelector("#right-pane .pane-actions");

    const leftWrap = leftActions?.querySelector("#left-wrap");
    const leftClear = leftActions?.querySelector("#left-clear");
    const rightWrap = rightActions?.querySelector("#right-wrap");
    const rightClear = rightActions?.querySelector("#right-clear");

    expect(syncToggle).toBeTruthy();
    expect(ignoreLeadingWhitespaceToggle).toBeTruthy();
    expect(wrapToggle).toBeNull();
    expect(foldToggle).toBeTruthy();
    expect(leftWrap).toBeNull();
    expect(leftClear).toBeTruthy();
    expect(rightWrap).toBeNull();
    expect(rightClear).toBeTruthy();

    const toolbarChildren = Array.from(toolbar?.children ?? []);
    expect(toolbarChildren.indexOf(syncToggle!.closest(".toggle")!)).toBeLessThan(
      toolbarChildren.indexOf(ignoreLeadingWhitespaceToggle!.closest(".toggle")!),
    );
    expect(
      toolbarChildren.indexOf(ignoreLeadingWhitespaceToggle!.closest(".toggle")!),
    ).toBeLessThan(
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
    expect(doc.body.textContent).toContain("差分のみ");
    expect(doc.querySelector("#fold-toggle")).toBeTruthy();
  });

  it("renders the header clear button label as 全クリア", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const clearButton = doc.querySelector<HTMLButtonElement>("#clear");

    expect(clearButton).toBeTruthy();
    expect(clearButton?.textContent?.trim()).toBe("全クリア");
  });

  it("renders a highlight icon button to the right of the diff-only toggle", () => {
    const dom = new JSDOM(APP_TEMPLATE);
    const doc = dom.window.document;

    const toolbar = doc.querySelector(".toolbar-right");
    const highlightButton = doc.querySelector<HTMLButtonElement>(
      "#highlight-toggle-button",
    );
    const highlightControl = highlightButton?.closest(".highlight-toggle-control");
    const highlightToggle = doc.querySelector<HTMLInputElement>("#highlight-toggle");
    const foldToggle = doc.querySelector<HTMLInputElement>("#fold-toggle");
    const foldControl = foldToggle?.closest(".toggle");
    const themeSwitch = doc.querySelector(".theme-switch");
    const toolbarChildren = Array.from(toolbar?.children ?? []);

    expect(highlightButton).toBeTruthy();
    expect(highlightButton?.getAttribute("aria-label")).toBe("ハイライト");
    expect(highlightButton?.getAttribute("aria-pressed")).toBe("true");
    expect(doc.querySelector(".highlight-toggle-button__icon-svg")).toBeTruthy();
    expect(highlightToggle).toBeTruthy();
    expect(highlightToggle?.hasAttribute("hidden")).toBe(true);
    expect(highlightControl).toBeTruthy();
    expect(foldControl).toBeTruthy();
    expect(themeSwitch).toBeTruthy();
    expect(toolbarChildren.indexOf(highlightControl!)).toBeGreaterThan(
      toolbarChildren.indexOf(foldControl!),
    );
    expect(toolbarChildren.indexOf(highlightControl!)).toBeLessThan(
      toolbarChildren.indexOf(themeSwitch!),
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

    const leftSave = doc.querySelector("#left-save-file");
    const rightSave = doc.querySelector("#right-save-file");
    const leftReload = doc.querySelector("#left-reload-file");
    const rightReload = doc.querySelector("#right-reload-file");
    const leftCopy = doc.querySelector("#left-copy");
    const rightCopy = doc.querySelector("#right-copy");
    const leftClear = doc.querySelector("#left-clear");
    const rightClear = doc.querySelector("#right-clear");
    const leftButton = doc.querySelector("#left-favorite-add");
    const rightButton = doc.querySelector("#right-favorite-add");
    const leftBar = doc.querySelector("#left-favorite-paths");
    const rightBar = doc.querySelector("#right-favorite-paths");
    const leftActions = Array.from(
      doc.querySelectorAll("#left-pane .pane-actions > *"),
    );
    const rightActions = Array.from(
      doc.querySelectorAll("#right-pane .pane-actions > *"),
    );

    expect(leftSave).toBeTruthy();
    expect(rightSave).toBeTruthy();
    expect((leftSave as HTMLButtonElement | null)?.disabled).toBe(true);
    expect((rightSave as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(leftSave?.textContent?.trim()).toBe("保存");
    expect(rightSave?.textContent?.trim()).toBe("保存");
    expect(leftReload).toBeTruthy();
    expect(rightReload).toBeTruthy();
    expect((leftReload as HTMLButtonElement | null)?.disabled).toBe(true);
    expect((rightReload as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(leftReload?.textContent?.trim()).toBe("再読み込み");
    expect(rightReload?.textContent?.trim()).toBe("再読み込み");
    expect(leftCopy).toBeTruthy();
    expect(rightCopy).toBeTruthy();
    expect(leftCopy?.textContent?.trim()).toBe("ソースコピー");
    expect(rightCopy?.textContent?.trim()).toBe("ソースコピー");
    expect(leftButton).toBeTruthy();
    expect(rightButton).toBeTruthy();
    expect(leftBar).toBeTruthy();
    expect(rightBar).toBeTruthy();
    expect(leftBar?.classList.contains("favorite-paths-list")).toBe(true);
    expect(rightBar?.classList.contains("favorite-paths-list")).toBe(true);
    expect(leftActions.indexOf(leftSave!)).toBeLessThan(leftActions.indexOf(leftReload!));
    expect(rightActions.indexOf(rightSave!)).toBeLessThan(rightActions.indexOf(rightReload!));
    expect(leftActions.indexOf(leftReload!)).toBeLessThan(leftActions.indexOf(leftCopy!));
    expect(rightActions.indexOf(rightReload!)).toBeLessThan(rightActions.indexOf(rightCopy!));
    expect(leftActions.indexOf(leftCopy!)).toBeLessThan(leftActions.indexOf(leftClear!));
    expect(rightActions.indexOf(rightCopy!)).toBeLessThan(rightActions.indexOf(rightClear!));
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
