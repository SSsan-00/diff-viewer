import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  bindWorkspaceDragHandlers,
  getWorkspaceAction,
  renderWorkspaces,
} from "./workspaces";

describe("workspaces ui helpers", () => {
  it("renders workspace items with actions", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [
        { id: "one", name: "One" },
        { id: "two", name: "Two" },
      ],
      { selectedId: "one", editingId: null },
    );

    const items = container.querySelectorAll(".workspace-item");
    expect(items.length).toBe(2);
    expect(items[0]?.querySelector("[data-action='select']")).toBeTruthy();
    expect(items[0]?.querySelector("[data-action='rename']")).toBeTruthy();
    expect(items[0]?.querySelector("[data-action='remove']")).toBeTruthy();
  });

  it("extracts workspace actions from targets", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [{ id: "alpha", name: "Alpha" }],
      { selectedId: "alpha", editingId: null },
    );

    const renameButton = container.querySelector<HTMLElement>(
      "[data-action='rename']",
    );
    const action = renameButton ? getWorkspaceAction(renameButton) : null;

    expect(action).toEqual({ type: "rename", id: "alpha" });
  });

  it("emits drag move events when items are dropped", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [
        { id: "first", name: "First" },
        { id: "second", name: "Second" },
      ],
      { selectedId: "first", editingId: null },
    );

    const moves: Array<{ from: number; to: number }> = [];
    bindWorkspaceDragHandlers(container, (move) => moves.push(move));

    const handles = container.querySelectorAll<HTMLElement>(".workspace-item__drag");
    const items = container.querySelectorAll<HTMLElement>(".workspace-item");
    const dragStart = new dom.window.Event("dragstart", { bubbles: true });
    Object.defineProperty(dragStart, "dataTransfer", {
      value: {
        effectAllowed: "",
        setData: () => undefined,
        setDragImage: () => undefined,
      },
    });
    handles[0]?.dispatchEvent(dragStart);

    const dragOver = new dom.window.Event("dragover", { bubbles: true });
    items[1]?.dispatchEvent(dragOver);

    const drop = new dom.window.Event("drop", { bubbles: true });
    items[1]?.dispatchEvent(drop);

    expect(moves).toEqual([{ from: 0, to: 1 }]);
  });
});
