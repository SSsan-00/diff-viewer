import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("index.html favicon", () => {
  it("embeds an svg favicon as a data url", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const doc = new JSDOM(html).window.document;
    const icon = doc.querySelector<HTMLLinkElement>("link[rel='icon']");

    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("type")).toBe("image/svg+xml");
    expect(icon?.getAttribute("href")?.startsWith("data:image/svg+xml")).toBe(
      true,
    );
  });

  it("contains an inert manual html source placeholder", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const doc = new JSDOM(html).window.document;
    const source = doc.querySelector<HTMLScriptElement>("#manual-html-source");

    expect(source).toBeTruthy();
    expect(source?.getAttribute("type")).toBe("text/plain");
    expect(source?.textContent?.trim()).toBe("__DIFF_VIEWER_MANUAL_HTML__");
  });

  it("filters only the injected zustand deprecation warning", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const warn = vi.fn();
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      beforeParse(window) {
        window.console.warn = warn;
      },
    });

    dom.window.console.warn(
      "[DEPRECATED] Default export is deprecated. Instead use `import { create } from 'zustand'`.",
    );

    expect(warn).not.toHaveBeenCalled();

    dom.window.console.warn("other warning", { detail: true });

    expect(warn).toHaveBeenCalledWith("other warning", { detail: true });
    dom.window.close();
  });
});
