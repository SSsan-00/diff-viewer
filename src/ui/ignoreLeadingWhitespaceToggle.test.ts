import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindIgnoreLeadingWhitespaceToggle } from "./ignoreLeadingWhitespaceToggle";

describe("ignore leading whitespace toggle", () => {
  it("calls recalcDiff callback when toggled", () => {
    const dom = new JSDOM(
      `<label class="toggle">
        <input id="ignore-leading-whitespace-toggle" type="checkbox" />
        <span>先頭の空白を無視</span>
      </label>`,
    );
    const input = dom.window.document.querySelector<HTMLInputElement>(
      "#ignore-leading-whitespace-toggle",
    )!;
    const onChange = vi.fn();
    const onAfterToggle = vi.fn();

    bindIgnoreLeadingWhitespaceToggle({
      input,
      initialEnabled: false,
      onChange,
      onAfterToggle,
    });

    input.checked = true;
    input.dispatchEvent(new dom.window.Event("change"));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(onAfterToggle).toHaveBeenCalledTimes(1);
  });
});
