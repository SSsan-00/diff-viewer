import { describe, expect, it } from "vitest";
import { getNextAnchorKey } from "./anchorNavigation";

describe("anchor navigation", () => {
  it("moves selection within bounds", () => {
    const keys = ["a", "b", "c"];
    expect(getNextAnchorKey(keys, "a", 1)).toBe("b");
    expect(getNextAnchorKey(keys, "b", 1)).toBe("c");
    expect(getNextAnchorKey(keys, "c", 1)).toBe("c");
    expect(getNextAnchorKey(keys, "c", -1)).toBe("b");
    expect(getNextAnchorKey(keys, "a", -1)).toBe("a");
  });

  it("returns null when selection is missing", () => {
    const keys = ["a", "b"];
    expect(getNextAnchorKey(keys, "missing", 1)).toBeNull();
  });
});
