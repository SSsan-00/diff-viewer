import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindSyntaxHighlightToggle } from "./syntaxHighlightToggle";

describe("syntax highlight toggle", () => {
  it("toggles editor languages on and off", () => {
    const dom = new JSDOM(`<label class="toggle"><input id="hl" type="checkbox" /></label>`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#hl")!;

    const modelA = {};
    const modelB = {};
    const setModelLanguage = vi.fn();
    const editors = [
      { getModel: () => modelA },
      { getModel: () => modelB },
    ];
    const getLanguageForEditor = (index: number) =>
      index === 0 ? "php" : "csharp";

    const controller = bindSyntaxHighlightToggle({
      input,
      editors,
      getLanguageForEditor,
      setModelLanguage,
      initialEnabled: true,
    });

    expect(controller).toBeTruthy();
    input.checked = false;
    input.dispatchEvent(new dom.window.Event("change"));
    expect(setModelLanguage).toHaveBeenCalledWith(modelA, "plaintext");
    expect(setModelLanguage).toHaveBeenCalledWith(modelB, "plaintext");

    setModelLanguage.mockClear();
    input.checked = true;
    input.dispatchEvent(new dom.window.Event("change"));
    expect(setModelLanguage).toHaveBeenCalledWith(modelA, "php");
    expect(setModelLanguage).toHaveBeenCalledWith(modelB, "csharp");
  });

  it("applies highlight programmatically", () => {
    const dom = new JSDOM(`<label class="toggle"><input id="hl" type="checkbox" /></label>`);
    const input = dom.window.document.querySelector<HTMLInputElement>("#hl")!;

    const model = {};
    const setModelLanguage = vi.fn();
    const controller = bindSyntaxHighlightToggle({
      input,
      editors: [{ getModel: () => model }],
      getLanguageForEditor: () => "javascript",
      setModelLanguage,
      initialEnabled: false,
    });

    controller?.applyHighlight(true);
    expect(setModelLanguage).toHaveBeenCalledWith(model, "javascript");
  });
});
