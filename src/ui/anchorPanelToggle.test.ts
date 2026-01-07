import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";
import { setupAnchorPanelToggle } from "./anchorPanelToggle";

function setupDom() {
  const dom = new JSDOM(APP_TEMPLATE);
  const document = dom.window.document;
  setupAnchorPanelToggle(document);
  return document;
}

describe("anchor panel toggle", () => {
  it("collapses and expands the anchor panel without losing content", () => {
    const document = setupDom();
    const panel = document.querySelector(".anchor-panel") as HTMLElement;
    const body = document.querySelector("#anchor-panel-body") as HTMLElement;
    const toggle = document.querySelector("#anchor-toggle") as HTMLButtonElement;
    const list = document.querySelector("#anchor-list") as HTMLUListElement;

    const sample = document.createElement("li");
    sample.textContent = "L1 ↔ R1";
    list.appendChild(sample);

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(body.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();

    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(body.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe("展開");
    expect(list.querySelectorAll("li").length).toBe(1);

    toggle.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(body.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("折りたたみ");
    expect(list.querySelectorAll("li").length).toBe(1);
  });
});
