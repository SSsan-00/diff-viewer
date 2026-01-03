import { describe, it, expect } from "vitest";
import { ScrollSyncController } from "./ScrollSyncController";

type ScrollEventHandler = (event: { scrollTop: number; scrollLeft: number }) => void;

class FakeAdapter {
  scrollTop = 0;
  scrollLeft = 0;
  setTopCalls = 0;
  setLeftCalls = 0;
  private handlers: ScrollEventHandler[] = [];

  onDidScrollChange(handler: ScrollEventHandler) {
    this.handlers.push(handler);
  }

  setScrollTop(value: number) {
    this.setTopCalls += 1;
    this.scrollTop = value;
    this.emit();
  }

  setScrollLeft(value: number) {
    this.setLeftCalls += 1;
    this.scrollLeft = value;
    this.emit();
  }

  userScroll(top: number, left: number) {
    this.scrollTop = top;
    this.scrollLeft = left;
    this.emit();
  }

  private emit() {
    const event = { scrollTop: this.scrollTop, scrollLeft: this.scrollLeft };
    this.handlers.forEach((handler) => handler(event));
  }
}

function createScheduler() {
  const callbacks: Array<() => void> = [];
  const schedule = (callback: () => void) => callbacks.push(callback);
  const flush = () => {
    while (callbacks.length > 0) {
      const next = callbacks.shift();
      next?.();
    }
  };
  return { schedule, flush };
}

describe("ScrollSyncController", () => {
  it("syncs scroll positions when enabled", () => {
    const left = new FakeAdapter();
    const right = new FakeAdapter();
    const scheduler = createScheduler();

    new ScrollSyncController(left, right, scheduler.schedule);

    left.userScroll(120, 30);

    expect(right.scrollTop).toBe(120);
    expect(right.scrollLeft).toBe(30);
    expect(right.setTopCalls).toBe(1);
    expect(right.setLeftCalls).toBe(1);

    scheduler.flush();
  });

  it("does not sync when disabled", () => {
    const left = new FakeAdapter();
    const right = new FakeAdapter();
    const scheduler = createScheduler();
    const controller = new ScrollSyncController(left, right, scheduler.schedule);

    controller.setEnabled(false);
    left.userScroll(80, 10);

    expect(right.scrollTop).toBe(0);
    expect(right.scrollLeft).toBe(0);
    expect(right.setTopCalls).toBe(0);
    expect(right.setLeftCalls).toBe(0);

    scheduler.flush();
  });

  it("prevents feedback loops caused by programmatic syncing", () => {
    const left = new FakeAdapter();
    const right = new FakeAdapter();
    const scheduler = createScheduler();

    new ScrollSyncController(left, right, scheduler.schedule);

    left.userScroll(50, 5);

    expect(right.setTopCalls).toBe(1);
    expect(right.setLeftCalls).toBe(1);
    expect(left.setTopCalls).toBe(0);
    expect(left.setLeftCalls).toBe(0);

    scheduler.flush();
  });
});
