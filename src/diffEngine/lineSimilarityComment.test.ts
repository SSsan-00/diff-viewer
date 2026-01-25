import { describe, it, expect } from "vitest";
import { normalizeCommentText } from "./lineSimilarity";

describe("normalizeCommentText", () => {
  it("normalizes line comments and xml doc comments", () => {
    expect(normalizeCommentText("// comment")).toBe("comment");
    expect(normalizeCommentText("/// <summary>comment</summary>")).toBe("comment");
  });

  it("normalizes whitespace and inline tags", () => {
    expect(normalizeCommentText("//   comment   here")).toBe("comment here");
    expect(normalizeCommentText("/// <summary> comment </summary>")).toBe("comment");
  });

  it("normalizes single-line block and html comments", () => {
    expect(normalizeCommentText("/* comment */")).toBe("comment");
    expect(normalizeCommentText("<!-- comment -->")).toBe("comment");
  });

  it("normalizes hash comments", () => {
    expect(normalizeCommentText("# comment")).toBe("comment");
  });
});
