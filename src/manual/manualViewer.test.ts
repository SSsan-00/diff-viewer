import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  decodeManualHtmlForEmbedding,
  encodeManualHtmlForEmbedding,
  getEmbeddedManualHtml,
  renderManualViewer,
} from "./manualViewer";

describe("manual viewer", () => {
  it("reads embedded manual html from the inert script source", () => {
    const dom = new JSDOM(`
      <body>
        <script id="manual-html-source" type="text/plain">
          <html><body><h1>Manual</h1></body></html>
        </script>
      </body>
    `);

    expect(getEmbeddedManualHtml(dom.window.document)).toContain("<h1>Manual</h1>");
  });

  it("treats the build placeholder as missing manual content", () => {
    const dom = new JSDOM(`
      <body>
        <script id="manual-html-source" type="text/plain">__DIFF_VIEWER_MANUAL_HTML__</script>
      </body>
    `);

    expect(getEmbeddedManualHtml(dom.window.document)).toBeNull();
  });

  it("escapes closing script tags for safe embedding and decodes them for srcdoc", () => {
    const html = "<html><body></script><p>after</p></body></html>";

    expect(encodeManualHtmlForEmbedding(html)).not.toContain("</script>");
    expect(decodeManualHtmlForEmbedding(encodeManualHtmlForEmbedding(html))).toBe(html);
  });

  it("renders a fullscreen manual iframe with a return action", () => {
    const dom = new JSDOM(`
      <body>
        <script id="manual-html-source" type="text/plain"><html><body>Manual</body></html></script>
        <div id="app"></div>
      </body>
    `);
    const onBack = vi.fn();

    renderManualViewer(dom.window.document.querySelector("#app")!, {
      document: dom.window.document,
      onBack,
      title: "操作マニュアル",
      backLabel: "アプリに戻る",
    });

    const shell = dom.window.document.querySelector(".manual-viewer");
    const iframe = dom.window.document.querySelector<HTMLIFrameElement>(
      ".manual-viewer__frame",
    );
    const backButton = dom.window.document.querySelector<HTMLButtonElement>(
      ".manual-viewer__back",
    );

    expect(shell).toBeTruthy();
    expect(iframe?.getAttribute("srcdoc")).toContain("Manual");
    expect(backButton?.textContent?.trim()).toBe("アプリに戻る");

    backButton?.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
