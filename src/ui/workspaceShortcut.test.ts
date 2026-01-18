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
  it("toggles the panel with Ctrl+N", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const panel = createController();

    const event = new dom.window.KeyboardEvent("keydown", {
      key: "n",
      ctrlKey: true,
      bubbles: true,
    });
    const handled = handleWorkspaceShortcut(event, {
      panel,
      isEditing: () => false,
    });

    expect(handled).toBe(true);
    expect(panel.isOpen()).toBe(true);
  });

  it("does not toggle when editing", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const panel = createController();

    const event = new dom.window.KeyboardEvent("keydown", {
      key: "n",
      ctrlKey: true,
      bubbles: true,
    });
    const handled = handleWorkspaceShortcut(event, {
      panel,
      isEditing: () => true,
    });

    expect(handled).toBe(false);
    expect(panel.isOpen()).toBe(false);
  });
});
