import type { CopyVisualRow } from "./paneSourceCopy";
import type { ToastVariant } from "./toast";

type ToastLike = {
  show: (message: string, variant?: ToastVariant) => void;
};

type ObjectUrlApi = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

export type DiffReportRowKind = "equal" | "insert" | "delete" | "replace";

export type DiffReportRow = {
  leftText: string;
  rightText: string;
  kind?: DiffReportRowKind;
};

export function buildReportRowsFromVisualRows(rows: CopyVisualRow[]): DiffReportRow[] {
  if (rows.length === 0) {
    return [];
  }
  return rows.map((row) => ({
    leftText: row.leftText,
    rightText: row.rightText,
  }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildRowClass(kind?: DiffReportRowKind): string {
  if (!kind) {
    return "";
  }
  return ` class="row-${kind}"`;
}

export function buildDiffReportHtml(
  rows: DiffReportRow[],
  meta: { title?: string; generatedAt?: string } = {},
): string {
  const title = meta.title ?? "差分レポート";
  const bodyRows =
    rows.length === 0
      ? `<tr><td></td><td></td></tr>`
      : rows
          .map(
            (row) =>
              `<tr${buildRowClass(row.kind)}><td>${escapeHtml(row.leftText)}</td><td>${escapeHtml(row.rightText)}</td></tr>`,
          )
          .join("\n");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 20px;
      font-family: "Yu Gothic UI", "Hiragino Sans", sans-serif;
      color: #1f2328;
      background: #ffffff;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 18px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
      border: 1px solid #d0d7de;
    }
    th,
    td {
      border: 1px solid #d0d7de;
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
      white-space: pre;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.45;
    }
    th {
      background: #f6f8fa;
      font-weight: 700;
    }
    .row-insert td:last-child {
      background: #e6ffec;
    }
    .row-delete td:first-child {
      background: #ffebe9;
    }
    .row-replace td {
      background: #fff8c5;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table aria-label="差分レポート">
    <thead>
      <tr><th>Left</th><th>Right</th></tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</body>
</html>
`;
}

export function downloadDiffReportHtml(
  html: string,
  fileName: string,
  doc: Document = document,
  urlApi: ObjectUrlApi = URL,
): boolean {
  if (!html) {
    return false;
  }
  const body = doc.body;
  if (!body) {
    return false;
  }

  let objectUrl: string | null = null;
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    objectUrl = urlApi.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = "none";
    body.appendChild(link);
    link.click();
    body.removeChild(link);
    return true;
  } catch (error) {
    console.warn("report download failed:", error);
    return false;
  } finally {
    if (objectUrl) {
      urlApi.revokeObjectURL(objectUrl);
    }
  }
}

export function exportDiffReport(options: {
  doc: Document;
  toast: ToastLike;
  buildHtml: () => string;
  download?: (
    html: string,
    fileName: string,
    doc: Document,
  ) => boolean;
  fileName?: string;
}): boolean {
  const {
    doc,
    toast,
    buildHtml,
    download = downloadDiffReportHtml,
    fileName = "diff-report.html",
  } = options;

  const html = buildHtml();
  if (!html) {
    toast.show("出力対象がありません", "error");
    return false;
  }

  const ok = download(html, fileName, doc);
  if (ok) {
    toast.show("差分レポートを出力しました。");
    return true;
  }
  toast.show("レポート出力に失敗しました。", "error");
  return false;
}

export function bindExportReportButton(options: {
  button: HTMLButtonElement | null;
  doc: Document;
  toast: ToastLike;
  buildHtml: () => string;
  download?: (
    html: string,
    fileName: string,
    doc: Document,
  ) => boolean;
  fileName?: string;
}): void {
  const {
    button,
    doc,
    toast,
    buildHtml,
    download = downloadDiffReportHtml,
    fileName = "diff-report.html",
  } = options;
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    exportDiffReport({
      doc,
      toast,
      buildHtml,
      download,
      fileName,
    });
  });
}
