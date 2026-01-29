import { describe, it, expect } from "vitest";
import { extractAppendLiteralWithMap } from "./appendLiteral";

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
});
