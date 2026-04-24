import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindSyntaxHighlightToggle } from "./syntaxHighlightToggle";

describe("syntax highlight toggle", () => {
  it("toggles editor languages on and off", () => {
    const dom = new JSDOM(
      `<div class="highlight-toggle-control">
        <button id="hl-btn" type="button" aria-label="ハイライト" aria-pressed="true"></button>
        <input id="hl" type="checkbox" />
      </div>`,
    );
    const input = dom.window.document.querySelector<HTMLInputElement>("#hl")!;
    const button = dom.window.document.querySelector<HTMLButtonElement>("#hl-btn")!;

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
      button,
      editors,
      getLanguageForEditor,
      setModelLanguage,
      initialEnabled: true,
    });

    expect(controller).toBeTruthy();
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click();

    expect(input.checked).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(setModelLanguage).toHaveBeenCalledWith(modelA, "plaintext");
    expect(setModelLanguage).toHaveBeenCalledWith(modelB, "plaintext");

    setModelLanguage.mockClear();
    button.click();

    expect(input.checked).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(setModelLanguage).toHaveBeenCalledWith(modelA, "php");
    expect(setModelLanguage).toHaveBeenCalledWith(modelB, "csharp");
  });

  it("applies highlight programmatically", () => {
    const dom = new JSDOM(
      `<div class="highlight-toggle-control">
        <button id="hl-btn" type="button" aria-label="ハイライト" aria-pressed="false"></button>
        <input id="hl" type="checkbox" />
      </div>`,
    );
    const input = dom.window.document.querySelector<HTMLInputElement>("#hl")!;
    const button = dom.window.document.querySelector<HTMLButtonElement>("#hl-btn")!;

    const model = {};
    const setModelLanguage = vi.fn();
    const controller = bindSyntaxHighlightToggle({
      input,
      button,
      editors: [{ getModel: () => model }],
      getLanguageForEditor: () => "javascript",
      setModelLanguage,
      initialEnabled: false,
    });

    expect(button.getAttribute("aria-pressed")).toBe("false");
    controller?.applyHighlight(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(setModelLanguage).toHaveBeenCalledWith(model, "javascript");
  });

  it("runs the post-toggle hook for user and programmatic refreshes", () => {
    const dom = new JSDOM(
      `<div class="highlight-toggle-control">
        <button id="hl-btn" type="button" aria-label="ハイライト" aria-pressed="true"></button>
        <input id="hl" type="checkbox" />
      </div>`,
    );
    const input = dom.window.document.querySelector<HTMLInputElement>("#hl")!;
    const button = dom.window.document.querySelector<HTMLButtonElement>("#hl-btn")!;

    const onAfterToggle = vi.fn();
    const controller = bindSyntaxHighlightToggle({
      input,
      button,
      editors: [{ getModel: () => ({}) }],
      getLanguageForEditor: () => "javascript",
      setModelLanguage: vi.fn(),
      onAfterToggle,
      initialEnabled: true,
    });

    button.click();
    controller?.applyHighlight(true);

    expect(onAfterToggle).toHaveBeenCalledTimes(2);
  });
});
