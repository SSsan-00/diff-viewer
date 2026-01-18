// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildFindWidgetOffsetZones,
  getFindWidgetHeight,
  isFindWidgetVisible,
} from "./findWidgetOffset";

const withFindWidget = (height: number, visible = true): HTMLElement => {
  const root = document.createElement("div");
  const widget = document.createElement("div");
  widget.className = "find-widget";
  if (!visible) {
    widget.setAttribute("aria-hidden", "true");
  }
  widget.getBoundingClientRect = () =>
    ({
      height,
      width: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => "",
    }) as DOMRect;
  root.appendChild(widget);
  return root;
};

describe("find widget offset", () => {
  it("detects visible widget height", () => {
    const root = withFindWidget(24);
    expect(isFindWidgetVisible(root)).toBe(true);
    expect(getFindWidgetHeight(root)).toBe(24);
  });

  it("treats hidden widget as zero height", () => {
    const root = withFindWidget(24, false);
    expect(isFindWidgetVisible(root)).toBe(false);
    expect(getFindWidgetHeight(root)).toBe(0);
  });

  it("adds a spacer to the shorter side", () => {
    const left = { getDomNode: () => withFindWidget(0) };
    const right = { getDomNode: () => withFindWidget(18) };
    const zones = buildFindWidgetOffsetZones(left, right);
    expect(zones.left).toHaveLength(1);
    expect(zones.right).toHaveLength(0);
    expect(zones.left[0].afterLineNumber).toBe(0);
    expect(zones.left[0].heightInPx).toBe(18);
  });

  it("prefers contentTop when available", () => {
    const left = {
      getDomNode: () => withFindWidget(12),
      getLayoutInfo: () => ({ contentTop: 0 }),
    };
    const right = {
      getDomNode: () => withFindWidget(12),
      getLayoutInfo: () => ({ contentTop: 28 }),
    };
    const zones = buildFindWidgetOffsetZones(left, right);
    expect(zones.left).toHaveLength(1);
    expect(zones.left[0].heightInPx).toBe(28);
  });
});
