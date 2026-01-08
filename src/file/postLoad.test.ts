import { describe, it, expect } from "vitest";
import { runPostLoadTasks } from "./postLoad";

describe("runPostLoadTasks", () => {
  it("does not throw when a task fails", () => {
    expect(() => {
      runPostLoadTasks([
        () => {
          throw new Error("boom");
        },
        () => undefined,
      ]);
    }).not.toThrow();
  });
});
