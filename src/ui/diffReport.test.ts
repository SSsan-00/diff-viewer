import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import type { CopyVisualRow } from "./paneSourceCopy";
import {
  bindExportReportButton,
  buildDiffReportHtml,
  buildReportRowsFromVisualRows,
  downloadDiffReportHtml,
  stripFileBoundaryLabelPrefix,
} from "./diffReport";

describe("buildReportRowsFromVisualRows", () => {
  it("preserves virtual gap rows and keeps row count", () => {
    const visualRows: CopyVisualRow[] = [
      { leftText: "same", rightText: "same" },
      { leftText: "", rightText: "only-right" },
      { leftText: "only-left", rightText: "" },
    ];

    const rows = buildReportRowsFromVisualRows(visualRows);

    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ leftText: "", rightText: "only-right", kind: "insert" });
    expect(rows[2]).toMatchObject({ leftText: "only-left", rightText: "", kind: "delete" });
  });

  it("prepends first loaded file names as header row", () => {
    const rows = buildReportRowsFromVisualRows(
      [{ leftText: "line1", rightText: "line1" }],
      {
        leftSegments: [{ fileName: "left.cs" }],
        rightSegments: [{ fileName: "right.php" }],
      },
    );

    expect(rows[0]).toMatchObject({ leftText: "left.cs", rightText: "right.php" });
    expect(rows[1]).toMatchObject({ leftText: "line1", rightText: "line1", kind: "equal" });
  });

  it("marks rows as equal when only leading whitespace differs and ignore option is on", () => {
    const rows = buildReportRowsFromVisualRows(
      [{ leftText: "    const total = sumList(numbers);", rightText: "const total = sumList(numbers);" }],
      { ignoreLeadingFileWhitespace: true },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("equal");
    expect(rows[0]?.leftInlineRanges).toBeUndefined();
    expect(rows[0]?.rightInlineRanges).toBeUndefined();
  });

  it("keeps non-leading diffs highlighted while suppressing leading whitespace highlight", () => {
    const rows = buildReportRowsFromVisualRows(
      [{ leftText: "    const total = sumList(numbers);", rightText: "const total = calcList(numbers);" }],
      { ignoreLeadingFileWhitespace: true },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("replace");
    expect(rows[0]?.leftInlineRanges?.some((range) => range.start === 0)).toBe(false);
    expect(rows[0]?.rightInlineRanges?.some((range) => range.start === 0)).toBe(false);
  });

  it("adds syntax ranges when syntax highlight is enabled", () => {
    const tokenizeLine = vi.fn((line: string, language: string) => {
      if (language === "typescript" && line.startsWith("const")) {
        return [{ start: 0, end: 5, className: "syntax-keyword" }];
      }
      return [];
    });
    const rows = buildReportRowsFromVisualRows(
      [{ leftText: "const total = 1;", rightText: "const total = 2;" }],
      {
        syntaxHighlightEnabled: true,
        leftLanguage: "typescript",
        rightLanguage: "typescript",
        tokenizeLine,
      },
    );

    expect(tokenizeLine).toHaveBeenCalledTimes(2);
    expect(rows[0]?.leftSyntaxRanges).toEqual([
      { start: 0, end: 5, className: "syntax-keyword" },
    ]);
    expect(rows[0]?.rightSyntaxRanges).toEqual([
      { start: 0, end: 5, className: "syntax-keyword" },
    ]);
  });
});

describe("stripFileBoundaryLabelPrefix", () => {
  it("removes File N: prefix and keeps file name only", () => {
    expect(stripFileBoundaryLabelPrefix("File 2: sample.cs")).toBe("sample.cs");
    expect(stripFileBoundaryLabelPrefix("File 12: foo/bar.php")).toBe("foo/bar.php");
    expect(stripFileBoundaryLabelPrefix("plain.txt")).toBe("plain.txt");
  });
});

describe("buildDiffReportHtml", () => {
  it("builds a two-column table report with escaped cells", () => {
    const html = buildDiffReportHtml([
      { leftText: "<head>", rightText: "plain" },
      { leftText: "", rightText: "&value" },
    ]);
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const table = doc.querySelector("table");
    const rows = Array.from(doc.querySelectorAll("tbody tr"));

    expect(table).toBeTruthy();
    expect(doc.querySelectorAll("thead th")).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelectorAll("td")[0]?.textContent).toBe("<head>");
    expect(rows[1]?.querySelectorAll("td")[1]?.textContent).toBe("&value");
    expect(html).toContain("white-space: nowrap");
    expect(html).not.toContain("white-space: pre");
    expect(html).toContain("overflow: hidden");
    expect(html).toContain("&lt;head&gt;");
    expect(html).toContain("&amp;value");
  });

  it("keeps leading spaces in simple mode output", () => {
    const html = buildDiffReportHtml([
      { leftText: "    const total = 1;", rightText: "value" },
    ]);

    expect(html).toContain("&nbsp;&nbsp;&nbsp;&nbsp;const total = 1;");
  });

  it("uses title tag and does not render body heading text by default", () => {
    const html = buildDiffReportHtml([{ leftText: "L", rightText: "R" }]);
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    expect(doc.title).toBe("差分レポート");
    expect(html).not.toContain("<h1>");
  });

  it("renders rich mode style when mode is rich", () => {
    const html = buildDiffReportHtml([{ leftText: "L", rightText: "R" }], {
      mode: "rich",
      theme: "dark",
      highlight: "off",
    });

    expect(html).toContain('data-report-mode="rich"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-highlight="off"');
    expect(html).toContain("white-space: normal");
    expect(html).toContain("overflow: hidden");
    expect(html).toContain("word-break: break-word");
    expect(html).toContain("background: #1f1b18");
    expect(html).toContain("td:first-child");
    expect(html).toContain("border-right: 1px solid var(--pane-divider-color)");
    expect(html).not.toContain("tr:nth-child(");
    expect(html).not.toContain("white-space: nowrap");
  });

  it("keeps leading spaces in rich mode output", () => {
    const html = buildDiffReportHtml(
      [
        {
          leftText: "  abc",
          rightText: "  adc",
          kind: "replace",
          leftInlineRanges: [{ start: 3, end: 4 }],
          rightInlineRanges: [{ start: 3, end: 4 }],
        },
      ],
      { mode: "rich" },
    );

    expect(html).toContain("&nbsp;&nbsp;a");
  });

  it("renders syntax token spans in rich mode", () => {
    const html = buildDiffReportHtml(
      [
        {
          leftText: "const total = 1;",
          rightText: "const total = 2;",
          kind: "replace",
          leftSyntaxRanges: [{ start: 0, end: 5, className: "syntax-keyword" }],
          rightSyntaxRanges: [{ start: 0, end: 5, className: "syntax-keyword" }],
        },
      ],
      { mode: "rich" },
    );

    expect(html).toContain('<span class="syntax-keyword">const</span>');
  });
});

describe("downloadDiffReportHtml", () => {
  it("creates and revokes object url for downloadable html", async () => {
    const dom = new JSDOM(`<body></body>`);
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();

    const createElement = dom.window.document.createElement.bind(dom.window.document);
    vi.spyOn(dom.window.document, "createElement").mockImplementation((tagName: string) => {
      const element = createElement(tagName);
      if (tagName.toLowerCase() === "a") {
        (element as HTMLAnchorElement).click = click;
      }
      return element;
    });

    const ok = downloadDiffReportHtml(
      "<!doctype html><html><body>report</body></html>",
      "diff-report.html",
      dom.window.document,
      { createObjectURL, revokeObjectURL },
    );

    expect(ok).toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    await expect(blob.text()).resolves.toContain("<body>report</body>");
  });
});

describe("bindExportReportButton", () => {
  it("downloads report on click and shows toast", () => {
    const dom = new JSDOM(`<button id="export-report" type="button">レポート出力</button>`);
    const button =
      dom.window.document.querySelector<HTMLButtonElement>("#export-report");
    const buildHtml = vi.fn(() => "<!doctype html><html><body>ok</body></html>");
    const download = vi.fn(() => true);
    const toast = { show: vi.fn() };

    bindExportReportButton({
      button,
      doc: dom.window.document,
      toast,
      buildHtml,
      download,
      fileName: "diff-report.html",
    });

    button?.click();

    expect(buildHtml).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(
      "<!doctype html><html><body>ok</body></html>",
      "diff-report.html",
      dom.window.document,
    );
    expect(toast.show).toHaveBeenCalledWith("レポートを出力しました。");
  });
});
