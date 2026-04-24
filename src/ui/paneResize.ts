type PaneResizeEditor = {
  layout: () => void;
};

type FrameRequest = (callback: FrameRequestCallback) => number;

type PaneResizeOptions = {
  container: HTMLElement;
  divider: HTMLElement;
  editors: PaneResizeEditor[];
  minPaneWidth?: number;
  onAfterResize?: () => void;
  requestFrame?: FrameRequest;
  eventTarget?: Window;
};

const DEFAULT_MIN_PANE_WIDTH = 240;
const DEFAULT_DIVIDER_WIDTH = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function bindPaneResize(options: PaneResizeOptions): void {
  const {
    container,
    divider,
    editors,
    onAfterResize,
    requestFrame = requestAnimationFrame,
    eventTarget = window,
    minPaneWidth = DEFAULT_MIN_PANE_WIDTH,
  } = options;

  let dragging = false;
  let pending = false;

  const scheduleAfterResize = () => {
    if (pending) {
      return;
    }
    pending = true;
    requestFrame(() => {
      pending = false;
      onAfterResize?.();
    });
  };

  const applyWidths = (leftWidth: number, rightWidth: number, dividerWidth: number) => {
    container.style.gridTemplateColumns = `${leftWidth}px ${dividerWidth}px ${rightWidth}px`;
    container.classList.add("is-pane-resized");
    editors.forEach((editor) => editor.layout());
    scheduleAfterResize();
  };

  const stopDragging = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    container.classList.remove("is-pane-resizing");
    eventTarget.removeEventListener("mousemove", handleMouseMove);
    eventTarget.removeEventListener("mouseup", stopDragging);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragging) {
      return;
    }
    event.preventDefault();
    const containerRect = container.getBoundingClientRect();
    const dividerWidth = Math.round(divider.getBoundingClientRect().width) || DEFAULT_DIVIDER_WIDTH;
    const availableWidth = Math.max(0, Math.round(containerRect.width) - dividerWidth);
    if (availableWidth <= 0) {
      return;
    }

    const effectiveMin = Math.min(minPaneWidth, Math.floor(availableWidth / 2));
    const maxLeft = Math.max(effectiveMin, availableWidth - effectiveMin);
    const rawLeft = Math.round(event.clientX - containerRect.left - dividerWidth / 2);
    const nextLeft = clamp(rawLeft, effectiveMin, maxLeft);
    const nextRight = availableWidth - nextLeft;
    applyWidths(nextLeft, nextRight, dividerWidth);
  };

  divider.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width <= 0) {
      return;
    }
    dragging = true;
    container.classList.add("is-pane-resizing");
    event.preventDefault();
    eventTarget.addEventListener("mousemove", handleMouseMove);
    eventTarget.addEventListener("mouseup", stopDragging);
  });
}
