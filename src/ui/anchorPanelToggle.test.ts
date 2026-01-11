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
    const toggle = document.querySelector("#anchor-toggle") as HTMLInputElement;
    const toggleLabel = toggle.closest("label");
    const list = document.querySelector("#anchor-list") as HTMLUListElement;

    const sample = document.createElement("li");
    sample.textContent = "L1 ↔ R1";
    list.appendChild(sample);

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(body.classList.contains("is-collapsed")).toBe(false);
    expect(list.classList.contains("is-collapsed")).toBe(false);
    expect(toggle.checked).toBe(false);
    expect(toggleLabel?.classList.contains("toggle")).toBe(true);

    toggle.checked = true;
    toggle.dispatchEvent(new document.defaultView!.Event("change"));

    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(body.classList.contains("is-collapsed")).toBe(true);
    expect(list.classList.contains("is-collapsed")).toBe(true);
    expect(toggle.checked).toBe(true);
    expect(list.querySelectorAll("li").length).toBe(1);

    toggle.checked = false;
    toggle.dispatchEvent(new document.defaultView!.Event("change"));

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(body.classList.contains("is-collapsed")).toBe(false);
    expect(list.classList.contains("is-collapsed")).toBe(false);
    expect(toggle.checked).toBe(false);
    expect(list.querySelectorAll("li").length).toBe(1);
  });
});
