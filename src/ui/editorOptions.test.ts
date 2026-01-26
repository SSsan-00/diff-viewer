import { describe, expect, it } from "vitest";
import { createEditorOptions } from "./editorOptions";

describe("createEditorOptions", () => {
  it("uses consistent indentation options", () => {
    const options = createEditorOptions("");

    expect(options.tabSize).toBe(4);
    expect(options.insertSpaces).toBe(true);
    expect(options.detectIndentation).toBe(false);
  });
});
