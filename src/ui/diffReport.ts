import type { CopyVisualRow } from "./paneSourceCopy";
import type { ToastVariant } from "./toast";
import type { Range } from "../diffEngine/types";
import { diffInlineWithAppendLiteral } from "../diffEngine/diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "../diffEngine/htmlAttributeSpaceDiff";

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
export type DiffReportTheme = "light" | "dark";
export type DiffReportHighlight = "on" | "off";
export type DiffReportSyntaxRange = Range & { className: string };

export type DiffReportRow = {
  leftText: string;
  rightText: string;
  kind?: DiffReportRowKind;
  leftInlineRanges?: Range[];
  rightInlineRanges?: Range[];
  leftSpaceRanges?: Range[];
  rightSpaceRanges?: Range[];
  leftSyntaxRanges?: DiffReportSyntaxRange[];
  rightSyntaxRanges?: DiffReportSyntaxRange[];
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
    ignoreLeadingFileWhitespace?: boolean;
    syntaxHighlightEnabled?: boolean;
    leftLanguage?: string;
    rightLanguage?: string;
    tokenizeLine?: (line: string, language: string) => DiffReportSyntaxRange[];
  } = {},
): DiffReportRow[] {
  const ignoreLeadingFileWhitespace = options.ignoreLeadingFileWhitespace === true;
  const syntaxHighlightEnabled = options.syntaxHighlightEnabled === true;
  const leftLanguage = options.leftLanguage;
  const rightLanguage = options.rightLanguage;
  const tokenizeLine = options.tokenizeLine;
  const mappedRows = rows.map((row) => ({
    leftText: row.leftText,
    rightText: row.rightText,
  }));

  const mappedWithDiff = mappedRows.map((row) => {
    const leftSyntaxRanges = buildSyntaxRanges(
      row.leftText,
      leftLanguage,
      syntaxHighlightEnabled,
      tokenizeLine,
    );
    const rightSyntaxRanges = buildSyntaxRanges(
      row.rightText,
      rightLanguage,
      syntaxHighlightEnabled,
      tokenizeLine,
    );
    let kind: DiffReportRowKind =
      row.leftText.length === 0 && row.rightText.length > 0
        ? "insert"
        : row.rightText.length === 0 && row.leftText.length > 0
          ? "delete"
          : row.leftText === row.rightText
            ? "equal"
            : "replace";
    if (
      ignoreLeadingFileWhitespace &&
      stripLeadingSpacesAndTabs(row.leftText) === stripLeadingSpacesAndTabs(row.rightText)
    ) {
      kind = "equal";
    }
    if (kind !== "replace") {
      return { ...row, kind, leftSyntaxRanges, rightSyntaxRanges };
    }
    const inline = diffInlineWithAppendLiteral(row.leftText, row.rightText, {
      ignoreLeadingFileWhitespace,
    });
    const spaceRanges = extractHtmlAttributeSpaceDiffRangesPair(
      row.leftText,
      row.rightText,
      inline.leftRanges,
      inline.rightRanges,
    );
    if (
      inline.leftRanges.length === 0 &&
      inline.rightRanges.length === 0 &&
      spaceRanges.left.length === 0 &&
      spaceRanges.right.length === 0
    ) {
      return {
        ...row,
        kind: "equal",
        leftSyntaxRanges,
        rightSyntaxRanges,
      };
    }
    return {
      ...row,
      kind,
      leftInlineRanges: inline.leftRanges,
      rightInlineRanges: inline.rightRanges,
      leftSpaceRanges: spaceRanges.left,
      rightSpaceRanges: spaceRanges.right,
      leftSyntaxRanges,
      rightSyntaxRanges,
    };
  });

  const firstLeftFileName = findFirstFileName(options.leftSegments);
  const firstRightFileName = findFirstFileName(options.rightSegments);
  if (!firstLeftFileName && !firstRightFileName) {
    return mappedWithDiff;
  }

  return [
    {
      leftText: firstLeftFileName,
      rightText: firstRightFileName,
      kind: "equal",
    },
    ...mappedWithDiff,
  ];
}

function stripLeadingSpacesAndTabs(value: string): string {
  return value.replace(/^[ \t]+/, "");
}

function normalizeSyntaxRange(
  range: DiffReportSyntaxRange,
  textLength: number,
): DiffReportSyntaxRange | null {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return null;
  }
  const start = Math.max(0, Math.min(textLength, range.start));
  const end = Math.max(0, Math.min(textLength, range.end));
  if (end <= start) {
    return null;
  }
  const className = range.className.trim();
  if (!className) {
    return null;
  }
  return { start, end, className };
}

function buildSyntaxRanges(
  text: string,
  language: string | undefined,
  enabled: boolean,
  tokenizeLine: ((line: string, language: string) => DiffReportSyntaxRange[]) | undefined,
): DiffReportSyntaxRange[] | undefined {
  if (!enabled || !tokenizeLine || !language || language === "plaintext" || text.length === 0) {
    return undefined;
  }
  const source = tokenizeLine(text, language);
  if (source.length === 0) {
    return undefined;
  }
  const normalized = source
    .map((range) => normalizeSyntaxRange(range, text.length))
    .filter((range): range is DiffReportSyntaxRange => range !== null);
  if (normalized.length === 0) {
    return undefined;
  }
  return normalized;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlWithPreservedWhitespace(text: string): string {
  let escaped = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === " ") {
      escaped += "&nbsp;";
      continue;
    }
    if (char === "\t") {
      escaped += "&nbsp;&nbsp;&nbsp;&nbsp;";
      continue;
    }
    escaped += escapeHtml(char);
  }
  return escaped;
}

function buildRowClass(kind?: DiffReportRowKind): string {
  if (!kind || kind === "equal") {
    return "";
  }
  return ` class="row-${kind}"`;
}

function isValidRange(range: Range, length: number): boolean {
  return Number.isFinite(range.start) &&
    Number.isFinite(range.end) &&
    range.start < range.end &&
    range.end > 0 &&
    range.start < length;
}

function renderCellTextWithRanges(
  text: string,
  layers: Array<{ ranges: Range[] | undefined; className: string }>,
): string {
  if (!text) {
    return "";
  }
  const boundaries = new Set<number>([0, text.length]);
  for (const layer of layers) {
    for (const range of layer.ranges ?? []) {
      if (!isValidRange(range, text.length)) {
        continue;
      }
      boundaries.add(Math.max(0, Math.min(text.length, range.start)));
      boundaries.add(Math.max(0, Math.min(text.length, range.end)));
    }
  }
  const points = Array.from(boundaries).sort((a, b) => a - b);
  const chunks: string[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (end <= start) {
      continue;
    }
    const part = escapeHtmlWithPreservedWhitespace(text.slice(start, end));
    const classNames: string[] = [];
    for (const layer of layers) {
      const active = (layer.ranges ?? []).some(
        (range) =>
          isValidRange(range, text.length) &&
          range.start < end &&
          range.end > start,
      );
      if (active) {
        classNames.push(layer.className);
      }
    }
    if (classNames.length === 0) {
      chunks.push(part);
    } else {
      chunks.push(`<span class="${classNames.join(" ")}">${part}</span>`);
    }
  }
  return chunks.join("");
}

function buildSyntaxLayers(
  ranges: DiffReportSyntaxRange[] | undefined,
): Array<{ ranges: Range[]; className: string }> {
  if (!ranges || ranges.length === 0) {
    return [];
  }
  const grouped = new Map<string, Range[]>();
  for (const range of ranges) {
    const current = grouped.get(range.className);
    if (current) {
      current.push({ start: range.start, end: range.end });
    } else {
      grouped.set(range.className, [{ start: range.start, end: range.end }]);
    }
  }
  return Array.from(grouped, ([className, classRanges]) => ({
    className,
    ranges: classRanges,
  }));
}

function renderRowCells(row: DiffReportRow, mode: DiffReportMode): string {
  if (mode !== "rich") {
    const left = escapeHtmlWithPreservedWhitespace(row.leftText);
    const right = escapeHtmlWithPreservedWhitespace(row.rightText);
    return `<td>${left}</td><td>${right}</td>`;
  }
  const left = renderCellTextWithRanges(row.leftText, [
    ...buildSyntaxLayers(row.leftSyntaxRanges),
    { ranges: row.leftInlineRanges, className: "inline-delete" },
    { ranges: row.leftSpaceRanges, className: "inline-space-diff" },
  ]);
  const right = renderCellTextWithRanges(row.rightText, [
    ...buildSyntaxLayers(row.rightSyntaxRanges),
    { ranges: row.rightInlineRanges, className: "inline-insert" },
    { ranges: row.rightSpaceRanges, className: "inline-space-diff" },
  ]);
  return `<td>${left}</td><td>${right}</td>`;
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
      background: #fffdf8;
      color: #3c2f22;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.45;
      --inline-insert-bg: rgba(80, 170, 90, 0.38);
      --inline-delete-bg: rgba(210, 90, 70, 0.35);
      --inline-insert-outline: rgba(60, 140, 90, 0.35);
      --inline-delete-outline: rgba(175, 80, 70, 0.35);
      --pane-divider-color: rgba(201, 190, 169, 0.75);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    td {
      border-bottom: 1px solid rgba(225, 214, 194, 0.55);
      padding: 2px 10px;
      text-align: left;
      vertical-align: top;
      white-space: normal;
      overflow: hidden;
      word-break: break-word;
      color: inherit;
      background: transparent;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    td:first-child {
      border-right: 1px solid var(--pane-divider-color);
    }
    .row-insert td:last-child {
      background: rgba(80, 170, 90, 0.18);
    }
    .row-delete td:first-child {
      background: rgba(210, 90, 70, 0.18);
    }
    .row-replace td {
      background: rgba(200, 170, 90, 0.2);
    }
    .inline-insert {
      background-color: var(--inline-insert-bg);
      border-radius: 3px;
    }
    .inline-delete {
      background-color: var(--inline-delete-bg);
      border-radius: 3px;
    }
    .inline-space-diff {
      background-color: rgba(255, 190, 20, 0.98);
      box-shadow:
        inset 0 0 0 1px rgba(130, 50, 0, 0.98),
        0 0 0 2px rgba(255, 140, 0, 0.75);
      border-radius: 3px;
    }
    .syntax-keyword {
      color: #8c2f6b;
      font-weight: 600;
    }
    .syntax-string {
      color: #0c7745;
    }
    .syntax-number {
      color: #92410d;
    }
    .syntax-comment {
      color: #6f6a63;
      font-style: italic;
    }
    .syntax-type {
      color: #2758b1;
    }
    .syntax-tag {
      color: #006f8f;
    }
    .syntax-attribute {
      color: #8a6015;
    }
    .syntax-operator {
      color: #534b41;
    }
    .syntax-delimiter {
      color: #4f473f;
    }
    .syntax-regexp {
      color: #8f2f66;
    }
    body[data-theme="light"] {
      background: #fffdf8;
      color: #3c2f22;
    }
    body[data-theme="light"] td {
      color: #3c2f22;
      border-bottom: 1px solid rgba(225, 214, 194, 0.55);
    }
    body[data-theme="light"] .row-insert td:last-child {
      background-color: rgba(80, 170, 90, 0.18);
    }
    body[data-theme="light"] .row-delete td:first-child {
      background-color: rgba(210, 90, 70, 0.18);
    }
    body[data-theme="light"] .row-replace td {
      background-color: rgba(200, 170, 90, 0.2);
    }
    body[data-theme="dark"] {
      background: #1f1b18;
      color: #e6e2d8;
      --inline-insert-bg: rgba(120, 220, 150, 0.28);
      --inline-delete-bg: rgba(255, 135, 115, 0.28);
      --inline-insert-outline: rgba(110, 220, 170, 0.75);
      --inline-delete-outline: rgba(255, 155, 135, 0.75);
      --pane-divider-color: rgba(59, 52, 45, 0.95);
    }
    body[data-theme="dark"] td {
      border-bottom: 1px solid rgba(59, 52, 45, 0.75);
    }
    body[data-theme="dark"] .row-insert td:last-child {
      background-color: rgba(80, 170, 90, 0.32);
    }
    body[data-theme="dark"] .row-delete td:first-child {
      background-color: rgba(210, 90, 70, 0.3);
    }
    body[data-theme="dark"] .row-replace td {
      background-color: rgba(200, 170, 90, 0.32);
    }
    body[data-theme="dark"] .inline-insert {
      background-color: var(--inline-insert-bg);
    }
    body[data-theme="dark"] .inline-delete {
      background-color: var(--inline-delete-bg);
    }
    body[data-theme="dark"][data-highlight="on"] .inline-insert {
      box-shadow: inset 0 0 0 1px var(--inline-insert-outline);
      text-shadow: 0 1px 0 rgba(10, 12, 16, 0.5);
    }
    body[data-theme="dark"][data-highlight="on"] .inline-delete {
      box-shadow: inset 0 0 0 1px var(--inline-delete-outline);
      text-shadow: 0 1px 0 rgba(10, 12, 16, 0.5);
    }
    body[data-theme="dark"] .inline-space-diff {
      background-color: rgba(255, 200, 60, 0.85);
      box-shadow:
        inset 0 0 0 3px rgba(255, 210, 140, 0.98),
        0 0 0 2px rgba(120, 220, 255, 0.95);
      text-decoration-color: rgba(255, 220, 160, 0.98);
    }
    body[data-theme="dark"] .syntax-keyword {
      color: #d67ad2;
    }
    body[data-theme="dark"] .syntax-string {
      color: #8fd39b;
    }
    body[data-theme="dark"] .syntax-number {
      color: #e3ae6d;
    }
    body[data-theme="dark"] .syntax-comment {
      color: #9a9488;
    }
    body[data-theme="dark"] .syntax-type {
      color: #83b0ff;
    }
    body[data-theme="dark"] .syntax-tag {
      color: #7ac4ff;
    }
    body[data-theme="dark"] .syntax-attribute {
      color: #e5c07b;
    }
    body[data-theme="dark"] .syntax-operator {
      color: #c9c2b7;
    }
    body[data-theme="dark"] .syntax-delimiter {
      color: #b8b2a8;
    }
    body[data-theme="dark"] .syntax-regexp {
      color: #ff9ecb;
    }
  `;
}

function buildReportStyles(mode: DiffReportMode): string {
  return mode === "rich" ? buildRichModeStyles() : buildSimpleModeStyles();
}

export function buildDiffReportHtml(
  rows: DiffReportRow[],
  meta: {
    title?: string;
    mode?: DiffReportMode;
    theme?: DiffReportTheme;
    highlight?: DiffReportHighlight;
  } = {},
): string {
  const title = meta.title?.trim() ?? "";
  const mode = meta.mode ?? "simple";
  const theme = meta.theme ?? "light";
  const highlight = meta.highlight ?? "on";
  const bodyRows =
    rows.length === 0
      ? `<tr><td></td><td></td></tr>`
      : rows
          .map(
            (row) =>
              `<tr${buildRowClass(row.kind)}>${renderRowCells(row, mode)}</tr>`,
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
<body data-report-mode="${mode}" data-theme="${theme}" data-highlight="${highlight}">
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
