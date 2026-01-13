import { describe, expect, it } from "vitest";
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
});
