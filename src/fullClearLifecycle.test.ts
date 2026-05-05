import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMainSource(): string {
  return readFileSync(resolve(process.cwd(), "src/main.ts"), "utf8");
}

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe("full clear lifecycle", () => {
  it("clears both editor models as programmatic edits so file-boundary guards do not reject it", () => {
    const source = readMainSource();
    const clearAllPanes = extractFunction(source, "clearAllPanes");

    expect(clearAllPanes).toContain('withProgrammaticEdit("left"');
    expect(clearAllPanes).toContain("clearEditorModel(leftEditor);");
    expect(clearAllPanes).toContain('withProgrammaticEdit("right"');
    expect(clearAllPanes).toContain("clearEditorModel(rightEditor);");
    expect(clearAllPanes).not.toContain("clearEditorsForUndo");
  });

  it("clears a single pane as a programmatic edit so file-boundary guards do not reject it", () => {
    const source = readMainSource();
    const buildPaneClearOptions = extractFunction(source, "buildPaneClearOptions");

    expect(buildPaneClearOptions).toContain("clearEditor: (editor) => {");
    expect(buildPaneClearOptions).toContain("withProgrammaticEdit(side");
    expect(buildPaneClearOptions).toContain("clearEditorModel(editor);");
  });
});
