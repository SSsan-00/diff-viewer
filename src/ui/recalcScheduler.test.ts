import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRecalcScheduler } from "./recalcScheduler";

describe("createRecalcScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces scheduled runs", () => {
    const run = vi.fn();
    const scheduler = createRecalcScheduler(run, 50);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs pending work after an in-flight execution", () => {
    let scheduler: ReturnType<typeof createRecalcScheduler>;
    let shouldQueue = true;
    const run = vi.fn(() => {
      if (shouldQueue) {
        shouldQueue = false;
        scheduler.runNow();
      }
    });

    scheduler = createRecalcScheduler(run, 10);
    scheduler.runNow();

    expect(run).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
