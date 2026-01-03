import { describe, it, expect } from "vitest";
import { normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("converts CRLF (\\r\\n) into LF (\\n)", () => {
    // Windows-style newlines should be normalized to a single \n.
    expect(normalizeText("a\r\nb\r\n")).toBe("a\nb\n");
  });

  it("converts CR (\\r) into LF (\\n)", () => {
    // Old Mac-style newlines should also become \n.
    expect(normalizeText("a\rb\r")).toBe("a\nb\n");
  });

  it("keeps LF-only text unchanged", () => {
    // If the text already uses \n, leave it as-is.
    expect(normalizeText("a\nb")).toBe("a\nb");
  });

  it("keeps empty string unchanged", () => {
    // No content means no changes.
    expect(normalizeText("")).toBe("");
  });
});
