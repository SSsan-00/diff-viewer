import { describe, expect, it, vi } from "vitest";
import { findDefinitionLine, goToLikelyDefinition } from "./vimDefinition";

describe("Vim definition jump", () => {
  it("finds class definitions", () => {
    expect(
      findDefinitionLine(
        [
          "const value = new SampleService();",
          "class SampleService {",
          "}",
        ].join("\n"),
        "SampleService",
        1,
      ),
    ).toEqual({ lineNumber: 2, column: 7 });
  });

  it("finds JavaScript function and variable definitions", () => {
    expect(
      findDefinitionLine("run();\nfunction run() {\n}", "run", 1),
    ).toEqual({ lineNumber: 2, column: 10 });
    expect(findDefinitionLine("use(value);\nconst value = 1;", "value", 1)).toEqual({
      lineNumber: 2,
      column: 7,
    });
  });

  it("finds C#-style method definitions", () => {
    expect(
      findDefinitionLine(
        "var result = Calculate(input);\nprivate static int Calculate(int input) {",
        "Calculate",
        1,
      ),
    ).toEqual({ lineNumber: 2, column: 20 });
  });

  it("moves the editor to a likely definition", () => {
    const setPosition = vi.fn();
    const revealLineInCenter = vi.fn();
    const focus = vi.fn();
    const lines = [
      "const result = render(value);",
      "function render(value) {",
      "  return value;",
      "}",
    ];

    const moved = goToLikelyDefinition({
      focus,
      getModel: () => ({
        getLineContent: (lineNumber) => lines[lineNumber - 1] ?? "",
        getLineCount: () => lines.length,
        getWordAtPosition: () => ({ word: "render" }),
      }),
      getPosition: () => ({ lineNumber: 1, column: 16 }),
      revealLineInCenter,
      setPosition,
    });

    expect(moved).toBe(true);
    expect(setPosition).toHaveBeenCalledWith({ lineNumber: 2, column: 10 });
    expect(revealLineInCenter).toHaveBeenCalledWith(2);
    expect(focus).toHaveBeenCalled();
  });
});
