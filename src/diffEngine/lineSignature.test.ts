import { describe, expect, it } from "vitest";
import { extractLineKey } from "./lineSignature";

describe("extractLineKey", () => {
  it("normalizes php tag wrapped brace lines", () => {
    expect(extractLineKey("{")).toBe("brace_open");
    expect(extractLineKey("<? { ?>")).toBe("brace_open");
    expect(extractLineKey("}")).toBe("brace_close");
    expect(extractLineKey("<? } ?>")).toBe("brace_close");
  });
});
