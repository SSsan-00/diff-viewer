import { describe, it, expect } from "vitest";
import { updateDiffJumpButtons } from "./diffJumpButtons";

describe("updateDiffJumpButtons", () => {
  it("updates buttons when they exist", () => {
    const prev = { disabled: false } as HTMLButtonElement;
    const next = { disabled: false } as HTMLButtonElement;

    updateDiffJumpButtons(prev, next, false);
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);

    updateDiffJumpButtons(prev, next, true);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it("ignores missing buttons", () => {
    expect(() => updateDiffJumpButtons(null, null, true)).not.toThrow();
  });
});
