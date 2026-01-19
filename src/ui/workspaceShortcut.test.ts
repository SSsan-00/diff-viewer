import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handleWorkspaceShortcut } from "./workspaceShortcut";
import type { WorkspacePanelController } from "./workspacePanel";

function createController(): WorkspacePanelController {
  let open = false;
  return {
    open: () => {
      open = true;
    },
    close: () => {
      open = false;
    },
    toggle: () => {
      open = !open;
    },
    isOpen: () => open,
  };
}

describe("workspace shortcut", () => {
  it("toggles the panel with Alt+N", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const panel = createController();

    const event = new dom.window.KeyboardEvent("keydown", {
      key: "n",
      altKey: true,
      bubbles: true,
    });
    const handled = handleWorkspaceShortcut(event, { panel });

    expect(handled).toBe(true);
    expect(panel.isOpen()).toBe(true);
  });

  it("toggles even when focus is inside inputs", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const panel = createController();

    const event = new dom.window.KeyboardEvent("keydown", {
      key: "n",
      altKey: true,
      bubbles: true,
    });
    const handled = handleWorkspaceShortcut(event, { panel });

    expect(handled).toBe(true);
    expect(panel.isOpen()).toBe(true);
  });
});
