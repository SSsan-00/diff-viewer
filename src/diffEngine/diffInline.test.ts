import { afterEach, describe, it, expect, vi } from "vitest";
import {
  createDiffInline,
  createDiffInlineBatch,
  diffInline,
  diffInlineBatch,
  diffInlineWithAppendLiteral,
  diffInlineWithAppendLiteralBatch,
  setDiffInlineBatchCore,
  setDiffInlineCore,
} from "./diffInline";

afterEach(() => {
  setDiffInlineCore(null);
  setDiffInlineBatchCore(null);
});

describe("diffInline", () => {
  it("returns empty ranges for identical lines", () => {
    expect(diffInline("abc", "abc")).toEqual({ leftRanges: [], rightRanges: [] });
  });

  it("returns ranges for a single replacement", () => {
    const result = diffInline("foo(bar)", "foo(baz)");

    expect(result.leftRanges).toEqual([{ start: 6, end: 7 }]);
    expect(result.rightRanges).toEqual([{ start: 6, end: 7 }]);
  });

  it("keeps UTF-16 ranges on whole emoji boundaries", () => {
    expect(diffInline("a🙂c", "a🙃c")).toEqual({
      leftRanges: [{ start: 1, end: 3 }],
      rightRanges: [{ start: 1, end: 3 }],
    });
  });

  it("normalizes ranges returned by an injected core to grapheme boundaries", () => {
    setDiffInlineCore(() => ({
      leftRanges: [{ start: 2, end: 3 }],
      rightRanges: [{ start: 2, end: 3 }],
    }));

    expect(diffInline("a🙂c", "a🙃c")).toEqual({
      leftRanges: [{ start: 1, end: 3 }],
      rightRanges: [{ start: 1, end: 3 }],
    });
  });

  it("expands combining-mark changes to the whole grapheme", () => {
    expect(diffInline("a\u0301b", "a\u0300b")).toEqual({
      leftRanges: [{ start: 0, end: 2 }],
      rightRanges: [{ start: 0, end: 2 }],
    });
  });

  it("expands ZWJ emoji changes to the whole grapheme", () => {
    expect(diffInline("👩‍💻", "👩‍🔬")).toEqual({
      leftRanges: [{ start: 0, end: 5 }],
      rightRanges: [{ start: 0, end: 5 }],
    });
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

  it("does not highlight matching AppendLine wrappers when both sides are identical", () => {
    const line = '        sb.AppendLine("      const qty = safeParseInt(formData.qty, NaN);");';
    const result = diffInlineWithAppendLiteral(line, line);

    expect(result).toEqual({
      leftRanges: [],
      rightRanges: [],
    });
  });

  it("keeps interpolated AppendLine expression changes visible", () => {
    const left = 'sb.AppendLine($"<b>{foo}</b>");';
    const right = 'sb.AppendLine($"<b>{bar}</b>");';
    const result = diffInlineWithAppendLiteral(left, right);

    expect(result.leftRanges.some((range) =>
      range.start <= left.indexOf("foo") && range.end >= left.indexOf("foo") + 3
    )).toBe(true);
    expect(result.rightRanges.some((range) =>
      range.start <= right.indexOf("bar") && range.end >= right.indexOf("bar") + 3
    )).toBe(true);
  });

  it("keeps verbatim AppendLine payload changes visible", () => {
    const left = 'sb.AppendLine(@"say ""old""");';
    const right = 'sb.AppendLine(@"say ""new""");';
    const result = diffInlineWithAppendLiteral(left, right);

    expect(result.leftRanges.some((range) =>
      range.start <= left.indexOf("old") && range.end >= left.indexOf("old") + 3
    )).toBe(true);
    expect(result.rightRanges.some((range) =>
      range.start <= right.indexOf("new") && range.end >= right.indexOf("new") + 3
    )).toBe(true);
  });

  it("shows verbatim quote escapes while preserving matching payload text", () => {
    const left = 'sb.AppendLine(@"say ""hello""");';
    const right = 'say "hello"';
    const result = diffInlineWithAppendLiteral(left, right);
    const firstEscapedQuote = left.indexOf('""');
    const secondEscapedQuote = left.lastIndexOf('""');

    expect(result.leftRanges.some((range) =>
      range.start < firstEscapedQuote + 2 && range.end > firstEscapedQuote
    )).toBe(true);
    expect(result.leftRanges.some((range) =>
      range.start < secondEscapedQuote + 2 && range.end > secondEscapedQuote
    )).toBe(true);
    expect(result.rightRanges).toHaveLength(0);
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

  it("can ignore leading file whitespace in inline diff while keeping other diffs", () => {
    const left = '    <div class="a  b" id="x"></div>';
    const right = '<div class="a b" id="x"></div>';
    const off = diffInlineWithAppendLiteral(left, right);
    const on = diffInlineWithAppendLiteral(left, right, {
      ignoreLeadingFileWhitespace: true,
      leftLineNo: 0,
      rightLineNo: 0,
      leftLeadingFileWhitespaceEligible: true,
      rightLeadingFileWhitespaceEligible: true,
    });

    expect(off.leftRanges.some((range) => range.start === 0)).toBe(true);
    expect(on.leftRanges.some((range) => range.start === 0)).toBe(false);
    expect(on.leftRanges.length + on.rightRanges.length).toBeGreaterThan(0);
  });

  it("does not highlight file-start indentation before AppendLine wrapper when enabled", () => {
    const left = "<!doctype html>";
    const right = '        sb.AppendLine("<!doctype html>");';

    const off = diffInlineWithAppendLiteral(left, right);
    const on = diffInlineWithAppendLiteral(left, right, {
      ignoreLeadingFileWhitespace: true,
      leftLineNo: 0,
      rightLineNo: 0,
      leftLeadingFileWhitespaceEligible: true,
      rightLeadingFileWhitespaceEligible: true,
    });

    expect(off.rightRanges.some((range) => range.start === 0)).toBe(true);
    expect(on.rightRanges.some((range) => range.start === 0)).toBe(false);
    expect(on.rightRanges.some((range) => range.start === 8)).toBe(true);
  });

  it("ignores leading whitespace inline diffs on later rows when enabled", () => {
    const off = diffInlineWithAppendLiteral("  value = 1;", "value = 1;");
    const on = diffInlineWithAppendLiteral("  value = 1;", "value = 1;", {
      ignoreLeadingFileWhitespace: true,
      leftLineNo: 3,
      rightLineNo: 3,
      leftLeadingFileWhitespaceEligible: true,
      rightLeadingFileWhitespaceEligible: true,
    });

    expect(off.leftRanges.some((range) => range.start === 0)).toBe(true);
    expect(on.leftRanges.some((range) => range.start === 0)).toBe(false);
  });

  it("keeps leading whitespace diffs visible when file-level ignore is ineligible", () => {
    const result = diffInlineWithAppendLiteral("  value = 1;", "value = 1;", {
      ignoreLeadingFileWhitespace: true,
      leftLeadingFileWhitespaceEligible: false,
      rightLeadingFileWhitespaceEligible: true,
    });

    expect(result.leftRanges.some((range) => range.start === 0)).toBe(true);
  });

  it("keeps AppendLine wrapper indentation diffs visible when file-level ignore is ineligible", () => {
    const left = '        sb.AppendLine("<!doctype html>");';
    const right = 'sb.AppendLine("<!doctype html>");';
    const result = diffInlineWithAppendLiteral(left, right, {
      ignoreLeadingFileWhitespace: true,
      leftLeadingFileWhitespaceEligible: false,
      rightLeadingFileWhitespaceEligible: false,
    });

    expect(result.leftRanges.some((range) => range.start === 0)).toBe(true);
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

  it("uses a deterministic coarse middle range above the LCS cell budget", () => {
    const prefix = "prefix:";
    const suffix = ":suffix";
    const left = `${prefix}${"a".repeat(1_100)}${suffix}`;
    const right = `${prefix}${"b".repeat(1_100)}${suffix}`;

    expect(diffInline(left, right)).toEqual({
      leftRanges: [{ start: prefix.length, end: prefix.length + 1_100 }],
      rightRanges: [{ start: prefix.length, end: prefix.length + 1_100 }],
    });
  });

  it("trims very large common edges before computing LCS", () => {
    const prefix = "a".repeat(10_000);
    const suffix = "b".repeat(10_000);

    expect(diffInline(`${prefix}x${suffix}`, `${prefix}y${suffix}`)).toEqual({
      leftRanges: [{ start: prefix.length, end: prefix.length + 1 }],
      rightRanges: [{ start: prefix.length, end: prefix.length + 1 }],
    });
  });

  it("handles a 100000-character one-sided inline change without an LCS table", () => {
    const left = "x".repeat(100_000);

    expect(diffInline(left, "")).toEqual({
      leftRanges: [{ start: 0, end: left.length }],
      rightRanges: [],
    });
  });

  it("skips identical rows before invoking a batch core", () => {
    const batchCore = vi.fn((inputs: Array<{ leftLine: string; rightLine: string }>) =>
      inputs.map(() => ({
        leftRanges: [{ start: 0, end: 1 }],
        rightRanges: [{ start: 0, end: 1 }],
      })),
    );
    setDiffInlineBatchCore(batchCore);

    expect(diffInlineBatch([
      { leftLine: "same", rightLine: "same" },
      { leftLine: "left", rightLine: "right" },
    ])).toEqual([
      { leftRanges: [], rightRanges: [] },
      {
        leftRanges: [{ start: 0, end: 1 }],
        rightRanges: [{ start: 0, end: 1 }],
      },
    ]);
    expect(batchCore).toHaveBeenCalledWith([
      { leftLine: "left", rightLine: "right" },
    ]);
  });

  it("lets callers replace the inline diff core", () => {
    const diffCore = vi.fn(() => ({
      leftRanges: [{ start: 1, end: 2 }],
      rightRanges: [{ start: 3, end: 4 }],
    }));
    const diffWithCore = createDiffInline(diffCore);

    expect(diffWithCore("left", "right")).toEqual({
      leftRanges: [{ start: 1, end: 2 }],
      rightRanges: [{ start: 3, end: 4 }],
    });
    expect(diffCore).toHaveBeenCalledOnce();
    expect(diffCore).toHaveBeenCalledWith("left", "right");
  });

  it("lets callers replace the batched inline diff core", () => {
    const diffBatchCore = vi.fn(() => [
      {
        leftRanges: [{ start: 1, end: 2 }],
        rightRanges: [{ start: 3, end: 4 }],
      },
    ]);
    const diffWithBatchCore = createDiffInlineBatch(diffBatchCore);

    expect(diffWithBatchCore([{ leftLine: "left", rightLine: "right" }])).toEqual([
      {
        leftRanges: [{ start: 1, end: 2 }],
        rightRanges: [{ start: 3, end: 4 }],
      },
    ]);
    expect(diffBatchCore).toHaveBeenCalledOnce();
    expect(diffBatchCore).toHaveBeenCalledWith([{ leftLine: "left", rightLine: "right" }]);
  });

  it("keeps append-literal batch results aligned with single-row diffing", () => {
    const inputs = [
      {
        leftLine: "<head>",
        rightLine: "sb.AppendLine(\"<headx>\");",
      },
      {
        leftLine: "    value = 1;",
        rightLine: "value = 1;",
        options: {
          ignoreLeadingFileWhitespace: true,
          leftLeadingFileWhitespaceEligible: true,
          rightLeadingFileWhitespaceEligible: true,
        },
      },
    ] as const;

    expect(diffInlineWithAppendLiteralBatch(inputs)).toEqual(
      inputs.map((input) =>
        diffInlineWithAppendLiteral(
          input.leftLine,
          input.rightLine,
          "options" in input ? input.options : undefined,
        ),
      ),
    );
  });
});
