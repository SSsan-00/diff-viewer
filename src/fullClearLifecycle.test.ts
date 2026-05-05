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
});
