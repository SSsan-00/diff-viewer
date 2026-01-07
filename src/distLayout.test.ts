import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { APP_TEMPLATE } from "./ui/template";

function loadDocument(): Document {
  return new JSDOM(APP_TEMPLATE).window.document;
}

describe("layout template", () => {
  it("keeps the pane layout consistent with the spec", () => {
    const document = loadDocument();
    const panes = document.querySelectorAll(".editor-pane");

    expect(panes.length).toBe(2);
    expect(document.querySelector(".toolbar")).toBeTruthy();
    expect(document.querySelector(".anchor-panel")).toBeTruthy();
    expect(document.querySelector(".editors")).toBeTruthy();
    expect(document.querySelector("#left-pane .pane-title-left .file-picker")).toBeTruthy();
    expect(document.querySelector("#right-pane .pane-title-left .file-picker")).toBeTruthy();
    expect(document.querySelector(".drop-zone")).toBeNull();
    expect(document.body.textContent ?? "").not.toContain("ここにファイルをドロップ");
  });
});
