import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import type { CopyVisualRow } from "./paneSourceCopy";
import {
  bindExportReportButton,
  buildDiffReportHtml,
  buildReportRowsFromVisualRows,
  downloadDiffReportHtml,
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
    expect(rows[1]).toEqual({ leftText: "", rightText: "only-right" });
    expect(rows[2]).toEqual({ leftText: "only-left", rightText: "" });
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
    const headers = Array.from(doc.querySelectorAll("thead th"));
    const rows = Array.from(doc.querySelectorAll("tbody tr"));

    expect(table).toBeTruthy();
    expect(headers.map((node) => node.textContent?.trim())).toEqual(["Left", "Right"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelectorAll("td")[0]?.textContent).toBe("<head>");
    expect(rows[1]?.querySelectorAll("td")[1]?.textContent).toBe("&value");
    expect(html).toContain("white-space: pre");
    expect(html).toContain("&lt;head&gt;");
    expect(html).toContain("&amp;value");
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
    expect(toast.show).toHaveBeenCalledWith("差分レポートを出力しました。");
  });
});
