import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { createWorkspacePanelController } from "./workspacePanel";

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;

  const panel = doc.createElement("div");
  const overlay = doc.createElement("div");
  const toggleButton = doc.createElement("button");

  panel.hidden = true;
  overlay.hidden = true;
  toggleButton.type = "button";

  doc.body.append(panel, overlay, toggleButton);

  return { doc, panel, overlay, toggleButton };
}

describe("workspace panel controller", () => {
  it("opens and closes via toggle and overlay", () => {
    const { doc, panel, overlay, toggleButton } = setupDom();
    const controller = createWorkspacePanelController({
      panel,
      overlay,
      toggleButton,
    });

    toggleButton.click();
    expect(panel.hidden).toBe(false);
    expect(overlay.hidden).toBe(false);
    expect(toggleButton.getAttribute("aria-expanded")).toBe("true");

    overlay.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes with Escape", () => {
    const { doc, panel, overlay, toggleButton } = setupDom();
    const controller = createWorkspacePanelController({
      panel,
      overlay,
      toggleButton,
    });

    controller.open();
    expect(panel.hidden).toBe(false);

    doc.dispatchEvent(
      new doc.defaultView!.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(panel.hidden).toBe(true);
  });
});
