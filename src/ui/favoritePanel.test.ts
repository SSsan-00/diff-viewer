import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { createFavoritePanelController } from "./favoritePanel";

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;

  const panel = doc.createElement("div");
  const overlay = doc.createElement("div");
  const addButton = doc.createElement("button");
  const cancelButton = doc.createElement("button");
  const input = doc.createElement("input");
  const list = doc.createElement("div");

  panel.hidden = true;
  overlay.hidden = true;
  addButton.type = "button";
  cancelButton.type = "button";

  panel.appendChild(list);
  doc.body.append(panel, overlay, addButton, cancelButton, input);

  return {
    dom,
    doc,
    panel,
    overlay,
    addButton,
    cancelButton,
    input,
    list,
  };
}

describe("favorite panel controller", () => {
  it("opens and closes with buttons and overlay", () => {
    const {
      doc,
      panel,
      overlay,
      addButton,
      cancelButton,
      input,
    } = setupDom();
    const onReset = vi.fn();
    const controller = createFavoritePanelController({
      panel,
      overlay,
      addButton,
      cancelButton,
      input,
      onReset,
    });

    input.value = "path";
    controller.open();

    expect(panel.hidden).toBe(false);
    expect(overlay.hidden).toBe(false);
    expect(addButton.getAttribute("aria-expanded")).toBe("true");
    expect(input.value).toBe("");
    expect(doc.activeElement).toBe(input);

    overlay.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true }));
    expect(panel.hidden).toBe(true);

    controller.open();
    cancelButton.click();
    expect(panel.hidden).toBe(true);
    expect(onReset).toHaveBeenCalled();
  });

  it("starts closed by default", () => {
    const { panel, overlay, addButton, cancelButton, input } = setupDom();
    createFavoritePanelController({
      panel,
      overlay,
      addButton,
      cancelButton,
      input,
    });

    expect(panel.hidden).toBe(true);
    expect(overlay.hidden).toBe(true);
    expect(addButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes with Escape and toggles state", () => {
    const { doc, panel, overlay, addButton, cancelButton, input } = setupDom();
    const controller = createFavoritePanelController({
      panel,
      overlay,
      addButton,
      cancelButton,
      input,
    });

    controller.toggle();
    expect(panel.hidden).toBe(false);

    doc.dispatchEvent(
      new doc.defaultView!.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(panel.hidden).toBe(true);

    controller.toggle();
    expect(panel.hidden).toBe(false);
    controller.toggle();
    expect(panel.hidden).toBe(true);
  });

  it("keeps the list hidden when the panel is closed", () => {
    const { panel, overlay, addButton, cancelButton, input, list } = setupDom();
    const controller = createFavoritePanelController({
      panel,
      overlay,
      addButton,
      cancelButton,
      input,
    });

    expect(panel.hidden).toBe(true);
    expect(panel.contains(list)).toBe(true);

    controller.open();
    expect(panel.hidden).toBe(false);

    controller.close();
    expect(panel.hidden).toBe(true);
  });
});
