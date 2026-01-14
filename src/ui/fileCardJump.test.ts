import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindFileCardJump } from "./fileCardJump";

describe("bindFileCardJump", () => {
  it("calls the jump handler with the card file name", () => {
    const dom = new JSDOM(`
      <div id="cards">
        <button class="file-card" data-file="alpha.txt">alpha.txt</button>
      </div>
    `);
    const doc = dom.window.document;
    const container = doc.querySelector<HTMLDivElement>("#cards");
    if (!container) {
      throw new Error("Missing container.");
    }

    const onJump = vi.fn();
    bindFileCardJump(container, onJump);

    const card = doc.querySelector<HTMLButtonElement>("button.file-card");
    card?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(onJump).toHaveBeenCalledWith("alpha.txt");
  });
});
