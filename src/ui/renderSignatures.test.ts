import { describe, expect, it } from "vitest";
import { shouldApplyBySignature } from "./renderSignatures";

describe("shouldApplyBySignature", () => {
  it("skips rendering when signatures and decoration ids are still valid", () => {
    expect(
      shouldApplyBySignature(["range:a"], ["range:a"], ["decoration-id"]),
    ).toBe(false);
  });

  it("applies rendering when signatures changed", () => {
    expect(
      shouldApplyBySignature(["range:a"], ["range:b"], ["decoration-id"]),
    ).toBe(true);
  });

  it("applies rendering after the editor model was replaced even with unchanged signatures", () => {
    expect(
      shouldApplyBySignature(["range:a"], ["range:a"], ["decoration-id"], {
        force: true,
      }),
    ).toBe(true);
  });

  it("reapplies rendering when Monaco lost decoration ids during a reload", () => {
    expect(shouldApplyBySignature(["range:a"], ["range:a"], [])).toBe(true);
  });
});
