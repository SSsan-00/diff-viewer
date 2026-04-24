// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { bindPaneResize } from "./paneResize";

type TestEditor = {
  layout: ReturnType<typeof vi.fn>;
};

function defineRect(
  element: HTMLElement,
  rect: Partial<DOMRect>,
): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
      bottom: rect.bottom ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => "",
    }),
    configurable: true,
  });
}

function setup() {
  const container = document.createElement("div");
  const divider = document.createElement("div");
  const left = { layout: vi.fn() };
  const right = { layout: vi.fn() };
  const onAfterResize = vi.fn();
  document.body.append(container, divider);
  defineRect(container, {
    left: 100,
    top: 0,
    width: 1000,
    height: 600,
    right: 1100,
    bottom: 600,
  });
  defineRect(divider, {
    left: 594,
    top: 0,
    width: 12,
    height: 600,
    right: 606,
    bottom: 600,
  });
  bindPaneResize({
    container,
    divider,
    editors: [left, right],
    onAfterResize,
    requestFrame: ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame,
    eventTarget: window,
  });

  return { container, divider, left, right, onAfterResize };
}

describe("bindPaneResize", () => {
  it("updates pane widths while dragging the divider", () => {
    const { container, divider, left, right, onAfterResize } = setup();

    divider.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 600 }),
    );
    window.dispatchEvent(
      new window.MouseEvent("mousemove", { bubbles: true, clientX: 700 }),
    );

    expect(container.style.gridTemplateColumns).toBe("594px 12px 394px");
    expect(left.layout).toHaveBeenCalledTimes(1);
    expect(right.layout).toHaveBeenCalledTimes(1);
    expect(onAfterResize).toHaveBeenCalledTimes(1);
  });

  it("clamps pane widths to the configured minimum", () => {
    const { container, divider } = setup();

    divider.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 600 }),
    );
    window.dispatchEvent(
      new window.MouseEvent("mousemove", { bubbles: true, clientX: 120 }),
    );

    expect(container.style.gridTemplateColumns).toBe("240px 12px 748px");
  });

  it("stops resizing after mouseup", () => {
    const { container, divider, left, right } = setup();

    divider.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 600 }),
    );
    window.dispatchEvent(
      new window.MouseEvent("mousemove", { bubbles: true, clientX: 650 }),
    );
    window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }));
    window.dispatchEvent(
      new window.MouseEvent("mousemove", { bubbles: true, clientX: 750 }),
    );

    expect(container.style.gridTemplateColumns).toBe("544px 12px 444px");
    expect(left.layout).toHaveBeenCalledTimes(1);
    expect(right.layout).toHaveBeenCalledTimes(1);
  });

  it("ignores non-primary button drags", () => {
    const { container, divider, left, right } = setup();

    divider.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, button: 1, clientX: 600 }),
    );
    window.dispatchEvent(
      new window.MouseEvent("mousemove", { bubbles: true, clientX: 700 }),
    );

    expect(container.style.gridTemplateColumns).toBe("");
    expect(left.layout).not.toHaveBeenCalled();
    expect(right.layout).not.toHaveBeenCalled();
  });
});
