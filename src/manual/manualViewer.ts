export const MANUAL_HTML_SOURCE_ID = "manual-html-source";
export const MANUAL_HTML_PLACEHOLDER = "__DIFF_VIEWER_MANUAL_HTML__";

type ManualViewerOptions = {
  document?: Document;
  onBack: () => void;
  title: string;
  backLabel: string;
};

export function encodeManualHtmlForEmbedding(html: string): string {
  return html.replace(/<\/script/gi, "<\\/script");
}

export function decodeManualHtmlForEmbedding(html: string): string {
  return html.replace(/<\\\/script/gi, "</script");
}

export function getEmbeddedManualHtml(doc: Document = document): string | null {
  const source = doc.getElementById(MANUAL_HTML_SOURCE_ID);
  const raw = source?.textContent?.trim() ?? "";
  if (!raw || raw === MANUAL_HTML_PLACEHOLDER) {
    return null;
  }
  return decodeManualHtmlForEmbedding(raw);
}

function removeExecutableManualScripts(
  html: string,
  doc: Document = document,
): Document {
  const parser = doc.defaultView?.DOMParser
    ? new doc.defaultView.DOMParser()
    : null;
  if (parser) {
    const parsed = parser.parseFromString(html, "text/html");
    parsed.querySelectorAll("script").forEach((script) => script.remove());
    return parsed;
  }

  const template = doc.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script").forEach((script) => script.remove());
  const parsed = doc.implementation.createHTMLDocument("");
  parsed.body.append(...Array.from(template.content.childNodes));
  return parsed;
}

function removeManualActiveContent(doc: Document): void {
  doc
    .querySelectorAll("iframe, object, embed")
    .forEach((element) => element.remove());
}

function removeManualInlineHandlers(doc: Document): void {
  doc.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function stripDangerousManualUrls(doc: Document): void {
  doc.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (
        name !== "href" &&
        name !== "src" &&
        name !== "xlink:href" &&
        name !== "action" &&
        name !== "formaction" &&
        name !== "srcdoc"
      ) {
        return;
      }
      const value = attribute.value
        .trim()
        .replace(/[\u0000-\u001f\u007f\s\uFFFD]+/g, "");
      if (/^(?:javascript|vbscript):/i.test(value) || /^data:text\/html/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function removeManualBaseElements(doc: Document): void {
  doc.querySelectorAll("base").forEach((element) => element.remove());
}

function serializeManualDocument(doc: Document): string {
  const doctype = doc.doctype ? `<!doctype ${doc.doctype.name}>\n` : "";
  return `${doctype}${doc.documentElement.outerHTML}`;
}

function createManualScriptNonce(doc: Document): string {
  const cryptoSource = doc.defaultView?.crypto ?? globalThis.crypto;
  if (cryptoSource?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoSource.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return "manual-navigation";
}

function installManualContentSecurityPolicy(doc: Document, nonce: string): void {
  doc
    .querySelectorAll('meta[http-equiv="Content-Security-Policy" i]')
    .forEach((element) => element.remove());
  const meta = doc.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = [
    "default-src 'none'",
    "img-src data:",
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
  doc.head.prepend(meta);
}

function rewriteManualHashLinks(doc: Document): void {
  doc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    const targetId = link.getAttribute("href")?.slice(1);
    if (!targetId) {
      return;
    }
    link.dataset.manualAnchorTarget = targetId;
    link.setAttribute("role", "button");
    link.setAttribute("tabindex", "0");
    link.removeAttribute("href");
  });
}

function appendManualNavigationScript(doc: Document, nonce: string): void {
  const script = doc.createElement("script");
  script.setAttribute("nonce", nonce);
  script.textContent = `
(() => {
  const scrollToTarget = (targetId) => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: "start" });
    if (targetId === "top") {
      window.scrollTo({ top: 0, left: 0 });
    }
  };

  document.addEventListener("click", (event) => {
    const source = event.target instanceof Element
      ? event.target.closest("[data-manual-anchor-target]")
      : null;
    if (!source) {
      return;
    }
    event.preventDefault();
    scrollToTarget(source.getAttribute("data-manual-anchor-target") || "");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const source = event.target instanceof Element
      ? event.target.closest("[data-manual-anchor-target]")
      : null;
    if (!source) {
      return;
    }
    event.preventDefault();
    scrollToTarget(source.getAttribute("data-manual-anchor-target") || "");
  });
})();
`;
  doc.body.append(script);
}

export function prepareManualHtmlForSandbox(
  html: string,
  doc: Document = document,
): string {
  const parsed = removeExecutableManualScripts(html, doc);
  removeManualActiveContent(parsed);
  removeManualInlineHandlers(parsed);
  stripDangerousManualUrls(parsed);
  removeManualBaseElements(parsed);
  const nonce = createManualScriptNonce(doc);
  installManualContentSecurityPolicy(parsed, nonce);
  rewriteManualHashLinks(parsed);
  appendManualNavigationScript(parsed, nonce);
  return serializeManualDocument(parsed);
}

function createFallbackManualHtml(): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>diff-viewer 操作マニュアル</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Segoe UI", "Yu Gothic", "Meiryo", sans-serif;
        color: #3a2f22;
        background: #f6efe3;
      }
      main {
        max-width: 560px;
        padding: 32px;
        line-height: 1.8;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>diff-viewer 操作マニュアル</h1>
      <p>この開発表示ではマニュアル本文がまだ埋め込まれていません。配布用HTMLをビルドすると、ここにMANUAL.htmlの内容が表示されます。</p>
    </main>
  </body>
</html>`;
}

export function renderManualViewer(
  container: Element,
  options: ManualViewerOptions,
): void {
  const doc = options.document ?? document;
  const manualHtml = prepareManualHtmlForSandbox(
    getEmbeddedManualHtml(doc) ?? createFallbackManualHtml(),
    doc,
  );
  container.innerHTML = `
    <section class="manual-viewer" aria-label="${options.title}">
      <header class="manual-viewer__bar">
        <strong class="manual-viewer__title">${options.title}</strong>
        <button class="manual-viewer__back" type="button">${options.backLabel}</button>
      </header>
      <iframe
        class="manual-viewer__frame"
        title="${options.title}"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
      ></iframe>
    </section>
  `;
  const iframe = container.querySelector<HTMLIFrameElement>(".manual-viewer__frame");
  if (iframe) {
    iframe.srcdoc = manualHtml;
  }
  container
    .querySelector<HTMLButtonElement>(".manual-viewer__back")
    ?.addEventListener("click", options.onBack);
}
