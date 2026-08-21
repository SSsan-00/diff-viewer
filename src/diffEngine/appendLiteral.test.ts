import { describe, it, expect } from "vitest";
import {
  extractAppendLiteralInlineMap,
  extractAppendLiteralWithMap,
} from "./appendLiteral";

describe("extractAppendLiteralWithMap", () => {
  it("extracts head tag from AppendLine", () => {
    const line = "sb.AppendLine(\"<head>\");";
    const result = extractAppendLiteralWithMap(line);
    expect(result?.payload).toBe("<head>");
  });

  it("unescapes quoted attributes", () => {
    const line = "sb.AppendLine(\"  <meta charset=\\\"utf-8\\\" />\");";
    const result = extractAppendLiteralWithMap(line);
    expect(result?.payload).toBe("  <meta charset=\"utf-8\" />");
  });

  it("extracts escaped quotes inside JS selectors", () => {
    const line = "sb.AppendLine(\"    const btn = document.querySelector(\\\"#btn\\\");\");";
    const result = extractAppendLiteralWithMap(line);
    expect(result?.payload).toBe("    const btn = document.querySelector(\"#btn\");");
  });

  it("extracts multibyte strings with escaped quotes", () => {
    const line = "sb.AppendLine(\"      msg.textContent = \\\"クリックされた！\\\";\");";
    const result = extractAppendLiteralWithMap(line);
    expect(result?.payload).toBe("      msg.textContent = \"クリックされた！\";");
  });

  it("handles backslashes and tabs", () => {
    const line = "sb.AppendLine(\"\\tfoo\\\\bar\");";
    const result = extractAppendLiteralWithMap(line);
    expect(result?.payload).toBe("\tfoo\\bar");
    expect(result?.indices.length).toBe(result?.payload.length);
  });

  it("keeps interpolation expressions semantic for matching but raw for display", () => {
    const line = 'sb.AppendLine($"<b>{customer.Name}</b>");';

    expect(extractAppendLiteralWithMap(line)?.payload).toBe("<b>{expr}</b>");
    const inline = extractAppendLiteralInlineMap(line);
    expect(inline?.payload).toBe("<b>{customer.Name}</b>");
    expect(inline?.indices.map((index) => line[index]).join("")).toBe(
      "<b>{customer.Name}</b>",
    );
  });

  it("keeps verbatim quote escapes raw for display", () => {
    const line = 'sb.AppendLine(@"say ""hello""");';

    expect(extractAppendLiteralWithMap(line)?.payload).toBe('say "hello"');
    const inline = extractAppendLiteralInlineMap(line);
    expect(inline?.payload).toBe('say ""hello""');
    expect(inline?.indices.map((index) => line[index]).join("")).toBe(
      'say ""hello""',
    );
  });
});
