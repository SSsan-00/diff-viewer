import { describe, it, expect } from "vitest";
import { diffInline } from "./diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./htmlAttributeSpaceDiff";

describe("extractHtmlAttributeSpaceDiffRanges", () => {
  it("detects extra spaces inside class attribute values", () => {
    const left = "<div class=\"foo bar\"></div>";
    const right = "<div class=\"foo  bar\"></div>";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.left).toHaveLength(0);
    expect(ranges.right.length).toBeGreaterThan(0);
  });

  it("detects removed spaces inside id attribute values", () => {
    const left = "<div id=\"foo bar\"></div>";
    const right = "<div id=\"foobar\"></div>";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.left.length).toBeGreaterThan(0);
  });

  it("detects added spaces in value attributes", () => {
    const left = "<input value=\"a b c\" />";
    const right = "<input value=\"a  b c\" />";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.right.length).toBeGreaterThan(0);
  });

  it("detects trailing spaces in data attributes", () => {
    const left = "<div data-x=\"a b\"></div>";
    const right = "<div data-x=\"a b \"></div>";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.right.length).toBeGreaterThan(0);
  });

  it("supports single-quoted attribute values", () => {
    const left = "<div class='foo bar'></div>";
    const right = "<div class='foo  bar'></div>";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.right.length).toBeGreaterThan(0);
  });

  it("does not flag tabs as space diffs", () => {
    const left = "<div class=\"foo\tbar\"></div>";
    const right = "<div class=\"foo bar\"></div>";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.left).toHaveLength(0);
    expect(ranges.right).toHaveLength(0);
  });

  it("does not flag text-node spaces", () => {
    const left = "<div>foo bar</div>";
    const right = "<div>foo  bar</div>";
    const inline = diffInline(left, right);
    const ranges = extractHtmlAttributeSpaceDiffRangesPair(
      left,
      right,
      inline.leftRanges,
      inline.rightRanges,
    );

    expect(ranges.right).toHaveLength(0);
  });
});
