import { describe, it, expect } from "vitest";
import { formatFileLoadError, shouldLogFileLoadError } from "./loadErrors";

describe("file load error formatting", () => {
  it("suppresses TDZ initialization errors", () => {
    const error = new ReferenceError("Cannot access 'p8' before initialization");
    const message = formatFileLoadError(error, "sample.txt");

    expect(message).toBe("読み込みに失敗しました (sample.txt)");
    expect(message).not.toContain("before initialization");
    expect(shouldLogFileLoadError(error)).toBe(false);
  });

  it("keeps normal error messages", () => {
    const error = new Error("Boom");
    const message = formatFileLoadError(error, "sample.txt");

    expect(message).toBe("Boom (sample.txt)");
    expect(shouldLogFileLoadError(error)).toBe(true);
  });
});
