import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readMainSource(): string {
  return readFileSync(resolve(process.cwd(), "src/main.ts"), "utf8");
}

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe("workspace save target lifecycle", () => {
  it("keeps stored file handles while restoring workspace pane state", () => {
    const source = readMainSource();
    const helper = extractFunction(
      source,
      "clearPaneSourceStateForWorkspaceRestore",
    );

    expect(helper).toContain(
      'clearPaneSourceState("left", { persistSaveTarget: false });',
    );
    expect(helper).toContain(
      'clearPaneSourceState("right", { persistSaveTarget: false });',
    );
  });

  it("restores file handles after a manual workspace switch", () => {
    const source = readMainSource();
    const switchBlock = source.slice(
      source.indexOf("function switchWorkspaceById"),
      source.indexOf("function handleWorkspaceRename"),
    );

    expect(switchBlock).toContain("clearPaneSourceStateForWorkspaceRestore();");
    expect(switchBlock).toContain(
      "void restorePaneSaveTargetsForWorkspace(workspaceState.selectedId);",
    );
    expect(switchBlock).not.toContain('clearPaneSourceState("left");');
    expect(switchBlock).not.toContain('clearPaneSourceState("right");');
  });
});
