import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  bindManualTopNavigation,
  decodeManualHtmlForEmbedding,
  encodeManualHtmlForEmbedding,
  getEmbeddedManualHtml,
  removeExecutableManualScripts,
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

  it("removes scripts before passing manual html to a sandboxed srcdoc iframe", () => {
    const dom = new JSDOM("<body></body>");
    const html = `<!doctype html>
      <html>
        <head><title>Manual</title><script>window.bad = true;</script></head>
        <body><h1>Manual</h1><script type="module">window.bad = true;</script></body>
      </html>`;

    const sanitized = removeExecutableManualScripts(html, dom.window.document);

    expect(sanitized).toContain("<h1>Manual</h1>");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("window.bad");
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

  it("keeps the manual TOP control inside the iframe and scrolls to the top", () => {
    const dom = new JSDOM("<body><iframe></iframe></body>");
    const frameDom = new JSDOM(`
      <body id="top">
        <main style="height: 2000px"></main>
        <a href="#top" class="to-top">TOP</a>
      </body>
    `);
    const iframe = dom.window.document.querySelector("iframe")!;
    const top = frameDom.window.document.querySelector("#top")!;
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(top, "scrollIntoView", {
      value: scrollIntoView,
      configurable: true,
    });
    Object.defineProperty(iframe, "contentDocument", {
      value: frameDom.window.document,
      configurable: true,
    });
    Object.defineProperty(iframe, "contentWindow", {
      value: { scrollTo },
      configurable: true,
    });

    bindManualTopNavigation(iframe);

    const topLink = frameDom.window.document.querySelector<HTMLAnchorElement>(".to-top")!;
    const event = new frameDom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    topLink.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
  });
});
