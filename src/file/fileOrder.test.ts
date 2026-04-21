import { describe, it, expect } from "vitest";
import { pairFilesWithHandlesInDisplayOrder, reorderRazorPairs } from "./fileOrder";

type Named = { name: string };

describe("reorderRazorPairs", () => {
  it("moves *.cshtml.cs before *.cshtml when the base matches", () => {
    const files: Named[] = [
      { name: "View.cshtml" },
      { name: "View.cshtml.cs" },
      { name: "Other.txt" },
    ];

    const result = reorderRazorPairs(files).map((file) => file.name);

    expect(result).toEqual(["View.cshtml.cs", "View.cshtml", "Other.txt"]);
  });

  it("keeps unrelated files in place while swapping the pair", () => {
    const files: Named[] = [
      { name: "X.txt" },
      { name: "View.cshtml" },
      { name: "Y.txt" },
      { name: "View.cshtml.cs" },
      { name: "Z.txt" },
    ];

    const result = reorderRazorPairs(files).map((file) => file.name);

    expect(result).toEqual([
      "X.txt",
      "View.cshtml.cs",
      "Y.txt",
      "View.cshtml",
      "Z.txt",
    ]);
  });

  it("does not change order when there is no pair", () => {
    const files: Named[] = [
      { name: "A.cshtml" },
      { name: "B.cshtml.cs" },
    ];

    const result = reorderRazorPairs(files).map((file) => file.name);

    expect(result).toEqual(["A.cshtml", "B.cshtml.cs"]);
  });

  it("keeps file handles attached when display order is adjusted", () => {
    const files: Named[] = [
      { name: "View.cshtml" },
      { name: "View.cshtml.cs" },
    ];
    const handles = [{ id: "view-handle" }, { id: "code-handle" }];

    const result = pairFilesWithHandlesInDisplayOrder(files, handles);

    expect(result).toEqual([
      { file: files[1], handle: handles[1] },
      { file: files[0], handle: handles[0] },
    ]);
  });
});
