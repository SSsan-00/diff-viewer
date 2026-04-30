import { describe, expect, it } from "vitest";
import { createEditorOptions } from "./editorOptions";

describe("createEditorOptions", () => {
  it("reserves horizontal scrollbar height on both panes", () => {
    const options = createEditorOptions("const value = 1;");

    expect(options.scrollbar).toEqual({
      horizontal: "visible",
      horizontalScrollbarSize: 12,
      verticalScrollbarSize: 12,
      alwaysConsumeMouseWheel: false,
    });
  });
});
