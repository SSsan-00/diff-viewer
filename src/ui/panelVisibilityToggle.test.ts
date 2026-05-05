// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { bindPanelVisibilityToggle } from "./panelVisibilityToggle";

describe("bindPanelVisibilityToggle", () => {
  it("fully collapses and reopens a panel while keeping the trigger usable", () => {
    const root = document.createElement("section");
    const button = document.createElement("button");
    const onToggle = vi.fn();
    root.append(button);

    bindPanelVisibilityToggle({
      root,
      button,
      collapseLabel: "閉じる",
      expandLabel: "開く",
      onToggle,
    });

    expect(root.classList.contains("is-fully-collapsed")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("閉じる");

    button.click();

    expect(root.classList.contains("is-fully-collapsed")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("開く");
    expect(button.textContent).toBe("▸");
    expect(onToggle).toHaveBeenLastCalledWith(true);

    button.click();

    expect(root.classList.contains("is-fully-collapsed")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("閉じる");
    expect(button.textContent).toBe("▾");
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it("respects an initially collapsed panel", () => {
    const root = document.createElement("section");
    const button = document.createElement("button");
    root.classList.add("is-fully-collapsed");

    bindPanelVisibilityToggle({
      root,
      button,
      collapseLabel: "閉じる",
      expandLabel: "開く",
    });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("開く");
    expect(button.textContent).toBe("▸");
  });
});
