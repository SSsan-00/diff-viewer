import type { ViewZoneSpec } from "./fileBoundaryZones";

export type FindWidgetHost = {
  getDomNode: () => HTMLElement | null;
  getLayoutInfo?: () => { contentTop?: number };
};

function getFindWidgetElement(root: HTMLElement | null): HTMLElement | null {
  if (!root) {
    return null;
  }
  const widget = root.querySelector(".find-widget");
  return widget instanceof HTMLElement ? widget : null;
}

export function isFindWidgetVisible(root: HTMLElement | null): boolean {
  const widget = getFindWidgetElement(root);
  if (!widget) {
    return false;
  }
  if (widget.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if (widget.classList.contains("hidden")) {
    return false;
  }
  if (widget.style.display === "none" || widget.style.visibility === "hidden") {
    return false;
  }
  return true;
}

export function getFindWidgetHeight(root: HTMLElement | null): number {
  const widget = getFindWidgetElement(root);
  if (!widget || !isFindWidgetVisible(root)) {
    return 0;
  }
  const rect = widget.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const bottom = rect.bottom - rootRect.top;
  if (bottom > 0) {
    return bottom;
  }
  if (rect.height > 0) {
    return rect.height;
  }
  if (widget.offsetHeight > 0) {
    return widget.offsetHeight;
  }
  const styleHeight = Number.parseFloat(widget.style.height);
  if (Number.isFinite(styleHeight) && styleHeight > 0) {
    return styleHeight;
  }
  return 0;
}

function getContentTop(editor: FindWidgetHost): number {
  if (!editor.getLayoutInfo) {
    return 0;
  }
  const info = editor.getLayoutInfo();
  const top = info.contentTop;
  return typeof top === "number" && top > 0 ? top : 0;
}

export function buildFindWidgetOffsetZones(
  leftEditor: FindWidgetHost,
  rightEditor: FindWidgetHost,
): { left: ViewZoneSpec[]; right: ViewZoneSpec[] } {
  const leftTop = getContentTop(leftEditor);
  const rightTop = getContentTop(rightEditor);
  const useContentTop = leftTop > 0 || rightTop > 0;
  const leftHeight = useContentTop
    ? leftTop
    : getFindWidgetHeight(leftEditor.getDomNode());
  const rightHeight = useContentTop
    ? rightTop
    : getFindWidgetHeight(rightEditor.getDomNode());
  const diff = rightHeight - leftHeight;
  if (diff === 0) {
    return { left: [], right: [] };
  }
  if (diff > 0) {
    return {
      left: [
        {
          afterLineNumber: 0,
          heightInPx: diff,
          className: "find-widget-offset",
        },
      ],
      right: [],
    };
  }
  return {
    left: [],
    right: [
      {
        afterLineNumber: 0,
        heightInPx: Math.abs(diff),
        className: "find-widget-offset",
      },
    ],
  };
}
