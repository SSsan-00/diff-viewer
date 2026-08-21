import { describe, expect, it } from "vitest";
import { canIgnoreLeadingWhitespaceInEditorText } from "./leadingWhitespacePolicy";

describe("leading whitespace display policy", () => {
  it("keeps per-line indentation ignoring enabled after a leading empty line", () => {
    expect(canIgnoreLeadingWhitespaceInEditorText("\n  value")).toBe(true);
  });

  it("does not treat a real empty line as leading indentation", () => {
    const lines = "\n  value".split("\n");

    expect(lines[0]).toBe("");
    expect(lines[1]).toBe("  value");
  });
});
