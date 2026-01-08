import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./template";
import { setupThemeToggle } from "./themeToggle";

function setupDom() {
  const dom = new JSDOM(APP_TEMPLATE);
  return dom.window.document;
}

describe("theme toggle", () => {
  it("applies the stored theme and toggles on change", () => {
    const document = setupDom();
    const storage = {
      getItem: vi.fn(() => "dark"),
      setItem: vi.fn(),
    };
    const onThemeChange = vi.fn();

    const initial = setupThemeToggle(document, { storage, onThemeChange });
    const toggle = document.querySelector("#theme-toggle") as HTMLInputElement;

    expect(initial).toBe("dark");
    expect(toggle.checked).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(onThemeChange).toHaveBeenCalledWith("dark");

    toggle.checked = false;
    toggle.dispatchEvent(new document.defaultView!.Event("change"));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(storage.setItem).toHaveBeenCalledWith("diff-viewer:theme", "light");
    expect(onThemeChange).toHaveBeenCalledWith("light");
  });
});
