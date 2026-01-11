import { describe, expect, it } from "vitest";
import { detectLanguageFromFileName, inferPaneLanguage } from "./language";

describe("detectLanguageFromFileName", () => {
  it("maps known extensions to Monaco language ids", () => {
    expect(detectLanguageFromFileName("index.php")).toBe("php");
    expect(detectLanguageFromFileName("view.cshtml.cs")).toBe("csharp");
    expect(detectLanguageFromFileName("view.cshtml")).toBe("csharp");
    expect(detectLanguageFromFileName("file.cs")).toBe("csharp");
    expect(detectLanguageFromFileName("main.ts")).toBe("typescript");
    expect(detectLanguageFromFileName("main.tsx")).toBe("typescript");
    expect(detectLanguageFromFileName("main.js")).toBe("javascript");
    expect(detectLanguageFromFileName("main.mjs")).toBe("javascript");
    expect(detectLanguageFromFileName("main.cjs")).toBe("javascript");
    expect(detectLanguageFromFileName("index.html")).toBe("html");
    expect(detectLanguageFromFileName("index.css")).toBe("css");
    expect(detectLanguageFromFileName("data.json")).toBe("json");
    expect(detectLanguageFromFileName("readme.md")).toBe("markdown");
  });

  it("falls back to plaintext for unknown extensions", () => {
    expect(detectLanguageFromFileName("notes.txt")).toBe("plaintext");
    expect(detectLanguageFromFileName("no-extension")).toBe("plaintext");
  });
});

describe("inferPaneLanguage", () => {
  it("uses plaintext when no files are loaded", () => {
    expect(inferPaneLanguage([])).toBe("plaintext");
  });

  it("returns the shared language when all files match", () => {
    expect(inferPaneLanguage(["a.php", "b.php"])).toBe("php");
  });

  it("prefers csharp when razor pairs are present", () => {
    expect(inferPaneLanguage(["view.cshtml", "view.cshtml.cs"])).toBe("csharp");
  });

  it("prefers php over html when mixed", () => {
    expect(inferPaneLanguage(["a.php", "b.html"])).toBe("php");
  });

  it("prefers typescript over javascript when mixed", () => {
    expect(inferPaneLanguage(["a.ts", "b.js"])).toBe("typescript");
  });
});
