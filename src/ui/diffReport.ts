import type { CopyVisualRow } from "./paneSourceCopy";
import type { ToastVariant } from "./toast";

type ToastLike = {
  show: (message: string, variant?: ToastVariant) => void;
};

type ObjectUrlApi = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

const FILE_BOUNDARY_PREFIX_PATTERN = /^File\s+\d+:\s*/;

export type DiffReportRowKind = "equal" | "insert" | "delete" | "replace";
export type DiffReportMode = "simple" | "rich";

export type DiffReportRow = {
  leftText: string;
  rightText: string;
  kind?: DiffReportRowKind;
};

type ReportFileSegment = {
  fileName?: string;
};

function findFirstFileName(segments: readonly ReportFileSegment[] | undefined): string {
  if (!segments || segments.length === 0) {
    return "";
  }
  for (const segment of segments) {
    const fileName = segment.fileName?.trim();
    if (fileName) {
      return fileName;
    }
  }
  return "";
}

export function stripFileBoundaryLabelPrefix(label: string | undefined): string | undefined {
  if (!label) {
    return label;
  }
  return label.replace(FILE_BOUNDARY_PREFIX_PATTERN, "");
}

export function buildReportRowsFromVisualRows(
  rows: CopyVisualRow[],
  options: {
    leftSegments?: readonly ReportFileSegment[];
    rightSegments?: readonly ReportFileSegment[];
  } = {},
): DiffReportRow[] {
  const mappedRows = rows.map((row) => ({
    leftText: row.leftText,
    rightText: row.rightText,
    kind:
      row.leftText.length === 0 && row.rightText.length > 0
        ? "insert"
        : row.rightText.length === 0 && row.leftText.length > 0
          ? "delete"
          : row.leftText === row.rightText
            ? "equal"
            : "replace",
  }));

  const firstLeftFileName = findFirstFileName(options.leftSegments);
  const firstRightFileName = findFirstFileName(options.rightSegments);
  if (!firstLeftFileName && !firstRightFileName) {
    return mappedRows;
  }

  return [
    {
      leftText: firstLeftFileName,
      rightText: firstRightFileName,
    },
    ...mappedRows,
  ];
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
  if (!kind || kind === "equal") {
    return "";
  }
  return ` class="row-${kind}"`;
}

function buildSimpleModeStyles(): string {
  return `
    body {
      margin: 20px;
      font-family: "Yu Gothic UI", "Hiragino Sans", sans-serif;
      color: #1f2328;
      background: #ffffff;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
      border: 1px solid #d0d7de;
    }
    td {
      border: 1px solid #d0d7de;
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
      white-space: nowrap;
      overflow: hidden;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.45;
    }
  `;
}

function buildRichModeStyles(): string {
  return `
    body {
      margin: 0;
      padding: 10px 0;
      background: #1f2328;
      color: #e6edf3;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    td {
      border-bottom: 1px solid #30363d;
      padding: 2px 10px;
      text-align: left;
      vertical-align: top;
      white-space: normal;
      overflow: visible;
      color: #e6edf3;
      font-size: 12px;
      line-height: 1.45;
    }
    tr:nth-child(odd) td {
      background: #1f2328;
    }
    tr:nth-child(even) td {
      background: #22272e;
    }
    .row-insert td:last-child {
      background: rgba(46, 160, 67, 0.24);
    }
    .row-delete td:first-child {
      background: rgba(248, 81, 73, 0.22);
    }
    .row-replace td {
      background: rgba(187, 128, 9, 0.22);
    }
  `;
}

function buildReportStyles(mode: DiffReportMode): string {
  return mode === "rich" ? buildRichModeStyles() : buildSimpleModeStyles();
}

export function buildDiffReportHtml(
  rows: DiffReportRow[],
  meta: { title?: string; mode?: DiffReportMode } = {},
): string {
  const title = meta.title?.trim() ?? "";
  const mode = meta.mode ?? "simple";
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
  <title>差分レポート</title>
  <style>
    ${buildReportStyles(mode)}
  </style>
</head>
<body data-report-mode="${mode}">
  ${title ? `<h1>${escapeHtml(title)}</h1>` : ""}
  <table aria-label="左右比較テーブル">
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
    toast.show("レポートを出力しました。");
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
