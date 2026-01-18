// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { bindEditorLayoutRecalc } from "./layoutRecalcWatcher";

type Handler = () => void;

const makeEditor = () => {
  let layoutHandlers: Handler[] = [];
  let contentHandlers: Handler[] = [];
  const root = document.createElement("div");
  const editor = {
    onDidLayoutChange: (handler: Handler) => {
      layoutHandlers.push(handler);
    },
    onDidContentSizeChange: (handler: Handler) => {
      contentHandlers.push(handler);
    },
    getLayoutInfo: () => ({ width: 800, height: 600 }),
    getContentHeight: () => 1200,
    getModel: () => ({ getLineCount: () => 120 }),
    getDomNode: () => root,
  };
  return {
    editor,
    emitLayout: () => layoutHandlers.forEach((handler) => handler()),
    emitContent: () => contentHandlers.forEach((handler) => handler()),
    setLayout: (width: number, height: number) => {
      editor.getLayoutInfo = () => ({ width, height });
    },
    setFindWidgetVisible: (visible: boolean) => {
      root.innerHTML = "";
      if (!visible) {
        return;
      }
      const widget = document.createElement("div");
      widget.className = "find-widget";
      root.appendChild(widget);
    },
  };
};

describe("bindEditorLayoutRecalc", () => {
  it("schedules recalc when layout changes", () => {
    const scheduler = vi.fn();
    const left = makeEditor();
    bindEditorLayoutRecalc([left.editor], scheduler);

    left.emitLayout();
    expect(scheduler).toHaveBeenCalledTimes(1);

    left.emitLayout();
    expect(scheduler).toHaveBeenCalledTimes(1);

    left.setLayout(820, 600);
    left.emitLayout();
    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  it("schedules recalc for content size changes", () => {
    const scheduler = vi.fn();
    const left = makeEditor();
    bindEditorLayoutRecalc([left.editor], scheduler);

    left.emitContent();
    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("listens to both editors and schedules from either side", () => {
    const scheduler = vi.fn();
    const left = makeEditor();
    const right = makeEditor();
    bindEditorLayoutRecalc([left.editor, right.editor], scheduler);

    right.emitLayout();
    expect(scheduler).toHaveBeenCalledTimes(1);

    left.emitContent();
    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  it("schedules recalc when find widget visibility changes", () => {
    const scheduler = vi.fn();
    const left = makeEditor();
    bindEditorLayoutRecalc([left.editor], scheduler);

    left.setFindWidgetVisible(true);
    left.emitLayout();
    expect(scheduler).toHaveBeenCalledTimes(1);

    left.setFindWidgetVisible(false);
    left.emitLayout();
    expect(scheduler).toHaveBeenCalledTimes(2);
  });
});
