import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { renderFileCards } from "./fileCards";

describe("renderFileCards", () => {
  it("renders file names as button cards", () => {
    const dom = new JSDOM(`<div id="cards"></div>`);
    const doc = dom.window.document;
    const container = doc.querySelector<HTMLDivElement>("#cards");

    if (!container) {
      throw new Error("Missing test container.");
    }

    renderFileCards(container, ["alpha.txt", "beta.txt"]);

    const cards = Array.from(container.querySelectorAll("button.file-card"));
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toBe("alpha.txt");
    expect(cards[0]?.getAttribute("title")).toBe("alpha.txt");
    expect(cards[0]?.getAttribute("data-file")).toBe("alpha.txt");
    expect(cards[1]?.textContent).toBe("beta.txt");
    expect(cards[1]?.getAttribute("aria-label")).toBe("beta.txt");
    expect(cards[1]?.getAttribute("data-file")).toBe("beta.txt");
  });
});
