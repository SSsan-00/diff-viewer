// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createToastManager } from "./toast";

describe("toast manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("shows and auto-dismisses toasts", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const manager = createToastManager(root);
    manager.show("hello");
    expect(root.querySelectorAll(".toast")).toHaveLength(1);

    vi.advanceTimersByTime(2700);
    expect(root.querySelectorAll(".toast")).toHaveLength(0);
  });

  it("caps toast count", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const manager = createToastManager(root);
    manager.show("one");
    manager.show("two");
    manager.show("three");
    manager.show("four");

    expect(root.querySelectorAll(".toast")).toHaveLength(3);
  });
});
