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

  it("reapplies unchanged signatures after the editor model version advances", () => {
    expect(
      shouldApplyBySignature(["range:a"], ["range:a"], ["decoration-id"], {
        currentModelVersionId: 7,
        nextModelVersionId: 8,
      }),
    ).toBe(true);
  });

  it("keeps unchanged signatures when the editor model version is unchanged", () => {
    expect(
      shouldApplyBySignature(["range:a"], ["range:a"], ["decoration-id"], {
        currentModelVersionId: 8,
        nextModelVersionId: 8,
      }),
    ).toBe(false);
  });
});
