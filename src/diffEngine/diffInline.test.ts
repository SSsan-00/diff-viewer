import { describe, it, expect } from "vitest";
import { diffInline, diffInlineWithAppendLiteral } from "./diffInline";

describe("diffInline", () => {
  it("returns empty ranges for identical lines", () => {
    expect(diffInline("abc", "abc")).toEqual({ leftRanges: [], rightRanges: [] });
  });

  it("returns ranges for a single replacement", () => {
    const result = diffInline("foo(bar)", "foo(baz)");

    expect(result.leftRanges).toEqual([{ start: 6, end: 7 }]);
    expect(result.rightRanges).toEqual([{ start: 6, end: 7 }]);
  });

  it("treats AppendLine payload as the inline diff input", () => {
    const left = "<head>";
    const right = "sb.AppendLine(\"<head>\");";
    const result = diffInlineWithAppendLiteral(left, right);
    expect(result.leftRanges).toHaveLength(0);
    const prefixEnd = right.indexOf("\"") + 1;
    const suffixStart = right.lastIndexOf("\"");
    expect(result.rightRanges).toContainEqual({ start: 0, end: prefixEnd });
    expect(result.rightRanges).toContainEqual({ start: suffixStart, end: right.length });
  });

  it("maps inline ranges into AppendLine payload only", () => {
    const left = "<head>";
    const right = "sb.AppendLine(\"<headx>\");";
    const result = diffInlineWithAppendLiteral(left, right);
    expect(result.rightRanges.length).toBeGreaterThan(0);
    const quoteIndex = right.indexOf("\"") + 1;
    const closingQuote = right.lastIndexOf("\"");
    for (const range of result.rightRanges) {
      if (range.end <= quoteIndex || range.start >= closingQuote) {
        continue;
      }
      expect(range.start).toBeGreaterThanOrEqual(quoteIndex);
      expect(range.end).toBeLessThanOrEqual(closingQuote);
    }
  });

  it("highlights AppendLine wrapper and escape backslashes without flooding the payload", () => {
    const left = "sb.AppendLine(\"    console.log(\\\"test\\\");\");";
    const right = "    console.log(\"test\");";
    const result = diffInlineWithAppendLiteral(left, right);

    const prefixEnd = left.indexOf("\"") + 1;
    const suffixStart = left.lastIndexOf("\"");
    const backslashIndex = left.indexOf("\\\"test");
    const payloadStart = prefixEnd;
    const payloadEnd = suffixStart;
    const testStart = left.indexOf("test");
    const testEnd = testStart + 4;

    expect(result.leftRanges).toContainEqual({ start: 0, end: prefixEnd });
    expect(result.leftRanges).toContainEqual({ start: suffixStart, end: left.length });
    expect(backslashIndex).toBeGreaterThan(-1);
    expect(result.leftRanges).toContainEqual({ start: backslashIndex, end: backslashIndex + 1 });

    for (const range of result.leftRanges) {
      expect(range.end <= testStart || range.start >= testEnd).toBe(true);
      expect(range.start < payloadStart && range.end > payloadStart).toBe(false);
      expect(range.start < payloadEnd && range.end > payloadEnd).toBe(false);
      expect(range.start === 0 && range.end === left.length).toBe(false);
    }

    expect(result.rightRanges).toHaveLength(0);
  });

  it("highlights leading whitespace differences", () => {
    const result = diffInline("    var foo = 1;", "var foo = 1;");

    expect(result.leftRanges.length).toBeGreaterThan(0);
  });

  it("highlights leading whitespace differences for keywords", () => {
    const result = diffInline("break;", "        break;");

    expect(result.rightRanges.length).toBeGreaterThan(0);
    expect(result.rightRanges[0].start).toBe(0);
  });

  it("highlights SQL date formatting differences", () => {
    const result = diffInline(
      "$sql .= \", to_char(date, 'yyyy/mm/dd')\";",
      "sql += \", FORMAT(date, 'yyyy/MM/dd')\";",
    );

    expect(result.leftRanges.length).toBeGreaterThan(0);
    expect(result.rightRanges.length).toBeGreaterThan(0);
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
