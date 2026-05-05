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
  const manualHtml = getEmbeddedManualHtml(doc) ?? createFallbackManualHtml();
  container.innerHTML = `
    <section class="manual-viewer" aria-label="${options.title}">
      <header class="manual-viewer__bar">
        <strong class="manual-viewer__title">${options.title}</strong>
        <button class="manual-viewer__back" type="button">${options.backLabel}</button>
      </header>
      <iframe
        class="manual-viewer__frame"
        title="${options.title}"
        sandbox="allow-same-origin allow-popups allow-forms"
      ></iframe>
    </section>
  `;
  const iframe = container.querySelector<HTMLIFrameElement>(".manual-viewer__frame");
  if (iframe) {
    iframe.setAttribute("srcdoc", manualHtml);
  }
  container
    .querySelector<HTMLButtonElement>(".manual-viewer__back")
    ?.addEventListener("click", options.onBack);
}
