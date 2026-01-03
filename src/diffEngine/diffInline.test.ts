import { describe, it, expect } from "vitest";
import { diffInline } from "./diffInline";

describe("diffInline", () => {
  it("returns empty ranges for identical lines", () => {
    expect(diffInline("abc", "abc")).toEqual({ leftRanges: [], rightRanges: [] });
  });

  it("returns ranges for a single replacement", () => {
    const result = diffInline("foo(bar)", "foo(baz)");

    expect(result.leftRanges).toEqual([{ start: 6, end: 7 }]);
    expect(result.rightRanges).toEqual([{ start: 6, end: 7 }]);
  });

  it("marks insertion at the start on the right only", () => {
    const result = diffInline("abc", "zabc");

    expect(result.leftRanges).toEqual([]);
    expect(result.rightRanges).toEqual([{ start: 0, end: 1 }]);
  });

  it("marks deletion at the end on the left only", () => {
    const result = diffInline("abcd", "abc");

    expect(result.leftRanges).toEqual([{ start: 3, end: 4 }]);
    expect(result.rightRanges).toEqual([]);
  });

  it("handles comparisons with empty lines", () => {
    expect(diffInline("", "a")).toEqual({
      leftRanges: [],
      rightRanges: [{ start: 0, end: 1 }],
    });

    expect(diffInline("a", "")).toEqual({
      leftRanges: [{ start: 0, end: 1 }],
      rightRanges: [],
    });
  });

  it("merges overly fragmented diffs for readability", () => {
    const result = diffInline("a1b2c3", "a1x2y3");

    expect(result.leftRanges).toEqual([{ start: 2, end: 5 }]);
    expect(result.rightRanges).toEqual([{ start: 2, end: 5 }]);
  });
});
