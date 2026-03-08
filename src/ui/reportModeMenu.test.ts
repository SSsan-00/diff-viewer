import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindReportModeMenu } from "./reportModeMenu";

describe("bindReportModeMenu", () => {
  it("uses simple mode by default", () => {
    const dom = new JSDOM(`
      <div class="report-export-control">
        <button id="report-mode-toggle" type="button"></button>
        <div id="report-mode-menu" role="menu" hidden>
          <button id="report-mode-simple" type="button">シンプル</button>
          <button id="report-mode-rich" type="button">リッチ</button>
        </div>
      </div>
    `);
    const doc = dom.window.document;

    const controller = bindReportModeMenu({
      triggerButton: doc.querySelector("#report-mode-toggle"),
      menu: doc.querySelector("#report-mode-menu"),
      simpleButton: doc.querySelector("#report-mode-simple"),
      richButton: doc.querySelector("#report-mode-rich"),
    });

    expect(controller.getMode()).toBe("simple");
    expect(doc.querySelector("#report-mode-simple")?.getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(doc.querySelector("#report-mode-rich")?.getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("opens menu on trigger click and closes on outside click", () => {
    const dom = new JSDOM(`
      <div class="report-export-control">
        <button id="report-mode-toggle" type="button"></button>
        <div id="report-mode-menu" role="menu" hidden>
          <button id="report-mode-simple" type="button">シンプル</button>
          <button id="report-mode-rich" type="button">リッチ</button>
        </div>
      </div>
      <div id="outside"></div>
    `);
    const doc = dom.window.document;
    const trigger = doc.querySelector<HTMLButtonElement>("#report-mode-toggle");
    const menu = doc.querySelector<HTMLDivElement>("#report-mode-menu");
    const outside = doc.querySelector<HTMLDivElement>("#outside");

    bindReportModeMenu({
      triggerButton: trigger,
      menu,
      simpleButton: doc.querySelector("#report-mode-simple"),
      richButton: doc.querySelector("#report-mode-rich"),
    });

    trigger?.click();
    expect(menu?.hidden).toBe(false);
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    outside?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    expect(menu?.hidden).toBe(true);
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  it("changes mode when rich option is selected", () => {
    const dom = new JSDOM(`
      <div class="report-export-control">
        <button id="report-mode-toggle" type="button"></button>
        <div id="report-mode-menu" role="menu" hidden>
          <button id="report-mode-simple" type="button">シンプル</button>
          <button id="report-mode-rich" type="button">リッチ</button>
        </div>
      </div>
    `);
    const doc = dom.window.document;
    const onChange = vi.fn();
    const trigger = doc.querySelector<HTMLButtonElement>("#report-mode-toggle");
    const rich = doc.querySelector<HTMLButtonElement>("#report-mode-rich");
    const menu = doc.querySelector<HTMLDivElement>("#report-mode-menu");

    const controller = bindReportModeMenu({
      triggerButton: trigger,
      menu,
      simpleButton: doc.querySelector("#report-mode-simple"),
      richButton: rich,
      onChange,
    });

    trigger?.click();
    rich?.click();

    expect(controller.getMode()).toBe("rich");
    expect(onChange).toHaveBeenCalledWith("rich");
    expect(rich?.getAttribute("aria-checked")).toBe("true");
  });

  it("positions menu with viewport-fixed coordinates when opened", () => {
    const dom = new JSDOM(`
      <div class="report-export-control">
        <button id="report-mode-toggle" type="button"></button>
        <div id="report-mode-menu" role="menu" hidden>
          <button id="report-mode-simple" type="button">シンプル</button>
          <button id="report-mode-rich" type="button">リッチ</button>
        </div>
      </div>
    `);
    const doc = dom.window.document;
    const trigger = doc.querySelector<HTMLButtonElement>("#report-mode-toggle");
    const menu = doc.querySelector<HTMLDivElement>("#report-mode-menu");

    if (!trigger || !menu) {
      throw new Error("test setup failed");
    }

    Object.defineProperty(dom.window, "innerWidth", { value: 320, configurable: true });
    Object.defineProperty(dom.window, "innerHeight", { value: 640, configurable: true });

    trigger.getBoundingClientRect = () =>
      ({
        top: 10,
        left: 260,
        right: 290,
        bottom: 42,
        width: 30,
        height: 32,
        x: 260,
        y: 10,
        toJSON: () => undefined,
      }) as DOMRect;

    menu.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 120,
        bottom: 84,
        width: 120,
        height: 84,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect;

    bindReportModeMenu({
      triggerButton: trigger,
      menu,
      simpleButton: doc.querySelector("#report-mode-simple"),
      richButton: doc.querySelector("#report-mode-rich"),
    });

    trigger.click();

    expect(menu.hidden).toBe(false);
    expect(menu.style.position).toBe("fixed");
    expect(menu.style.top).toBe("48px");
    expect(menu.style.left).toBe("170px");
  });
});
