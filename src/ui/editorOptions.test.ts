import { describe, expect, it } from "vitest";
import { createEditorOptions } from "./editorOptions";

describe("editor options", () => {
  it("disables sticky scroll for scope header display", () => {
    const options = createEditorOptions("sample");

    expect(options.stickyScroll?.enabled).toBe(false);
  });
});
