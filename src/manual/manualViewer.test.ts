import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  decodeManualHtmlForEmbedding,
  encodeManualHtmlForEmbedding,
  getEmbeddedManualHtml,
  prepareManualHtmlForSandbox,
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

  it("removes manual scripts and installs sandbox-safe in-page navigation", () => {
    const dom = new JSDOM("<body></body>");
    const html = `<!doctype html>
      <html>
        <head><title>Manual</title><script>window.bad = true;</script></head>
        <body id="top">
          <h1>Manual</h1>
          <a href="#overview">Overview</a>
          <a href="#top" class="to-top">TOP</a>
          <img src="data:image/png;base64,AA==" onerror="window.bad = true">
          <a href="java\u0000script:window.bad = true">bad link</a>
          <form action="javascript:window.bad = true"></form>
          <iframe srcdoc="<script>window.bad = true;</script>"></iframe>
          <object data="data:text/html,<script>window.bad = true;</script>"></object>
          <script type="module">window.bad = true;</script>
        </body>
      </html>`;

    const prepared = prepareManualHtmlForSandbox(html, dom.window.document);
    const preparedDom = new JSDOM(prepared);
    const scripts = preparedDom.window.document.querySelectorAll("script");
    const overviewLink =
      preparedDom.window.document.querySelector<HTMLAnchorElement>(
        "[data-manual-anchor-target='overview']",
      );
    const topLink = preparedDom.window.document.querySelector<HTMLAnchorElement>(
      ".to-top",
    );
    const csp = preparedDom.window.document.querySelector<HTMLMetaElement>(
      'meta[http-equiv="Content-Security-Policy"]',
    );
    const image = preparedDom.window.document.querySelector("img");
    const badLink = Array.from(preparedDom.window.document.querySelectorAll("a"))
      .find((link) => link.textContent === "bad link");
    const form = preparedDom.window.document.querySelector("form");

    expect(prepared).toContain("<h1>Manual</h1>");
    expect(prepared).not.toContain("window.bad");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.textContent).toContain("data-manual-anchor-target");
    expect(scripts[0]?.getAttribute("nonce")).toBeTruthy();
    expect(csp?.content).toContain(`script-src 'nonce-${scripts[0]?.getAttribute("nonce")}'`);
    expect(csp?.content).toContain("default-src 'none'");
    expect(overviewLink?.getAttribute("href")).toBeNull();
    expect(overviewLink?.getAttribute("role")).toBe("button");
    expect(topLink?.dataset.manualAnchorTarget).toBe("top");
    expect(topLink?.getAttribute("href")).toBeNull();
    expect(image?.getAttribute("src")).toBe("data:image/png;base64,AA==");
    expect(image?.getAttribute("onerror")).toBeNull();
    expect(badLink?.getAttribute("href")).toBeNull();
    expect(form?.getAttribute("action")).toBeNull();
    expect(preparedDom.window.document.querySelector("iframe")).toBeNull();
    expect(preparedDom.window.document.querySelector("object")).toBeNull();
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

  it("renders the manual iframe with script execution enabled for its own sanitized navigation", () => {
    const dom = new JSDOM(`
      <body>
        <script id="manual-html-source" type="text/plain">
          <html><body id="top"><a href="#top" class="to-top">TOP</a></body></html>
        </script>
        <div id="app"></div>
      </body>
    `);

    renderManualViewer(dom.window.document.querySelector("#app")!, {
      document: dom.window.document,
      onBack: vi.fn(),
      title: "操作マニュアル",
      backLabel: "アプリに戻る",
    });

    const iframe = dom.window.document.querySelector<HTMLIFrameElement>(
      ".manual-viewer__frame",
    );

    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe?.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe?.getAttribute("srcdoc")).toContain("data-manual-anchor-target=\"top\"");
    expect(iframe?.getAttribute("srcdoc")).not.toContain("href=\"#top\"");
  });
});
