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
        {
          id: "one",
          name: "One",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
        {
          id: "two",
          name: "Two",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
      { selectedId: "one", editingId: null, focusedId: null },
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
      [
        {
          id: "alpha",
          name: "Alpha",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
      { selectedId: "alpha", editingId: null, focusedId: null },
    );

    const renameButton = container.querySelector<HTMLElement>(
      "[data-action='rename']",
    );
    const action = renameButton ? getWorkspaceAction(renameButton) : null;

    expect(action).toEqual({ type: "rename", id: "alpha" });
  });

  it("treats workspace item clicks as selection", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [
        {
          id: "alpha",
          name: "Alpha",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
      { selectedId: "alpha", editingId: null, focusedId: null },
    );

    const item = container.querySelector<HTMLElement>(".workspace-item");
    const action = item ? getWorkspaceAction(item) : null;

    expect(action).toEqual({ type: "select", id: "alpha" });
  });

  it("marks only the selected workspace item", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [
        {
          id: "one",
          name: "One",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
        {
          id: "two",
          name: "Two",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
      { selectedId: "two", editingId: null, focusedId: null },
    );

    const selected = container.querySelectorAll(".workspace-item--selected");
    expect(selected.length).toBe(1);
    expect(selected[0]?.dataset.id).toBe("two");
  });

  it("marks the focused workspace item when focusedId is provided", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [
        {
          id: "one",
          name: "One",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
        {
          id: "two",
          name: "Two",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
      { selectedId: "one", editingId: null, focusedId: "two" },
    );

    const focused = container.querySelectorAll(".workspace-item--focused");
    expect(focused.length).toBe(1);
    expect(focused[0]?.dataset.id).toBe("two");
  });

  it("emits drag move events when items are dropped", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const doc = dom.window.document;
    const container = doc.createElement("div");
    renderWorkspaces(
      container,
      [
        {
          id: "first",
          name: "First",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
        {
          id: "second",
          name: "Second",
          leftText: "",
          rightText: "",
          anchors: {
            manualAnchors: [],
            autoAnchor: null,
            suppressedAutoAnchorKey: null,
            pendingLeftLineNo: null,
            pendingRightLineNo: null,
            selectedAnchorKey: null,
          },
        },
      ],
      { selectedId: "first", editingId: null, focusedId: null },
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
