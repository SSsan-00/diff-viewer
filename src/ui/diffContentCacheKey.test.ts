import { describe, expect, it } from "vitest";
import { buildDiffContentCacheKey } from "./diffContentCacheKey";

const base = {
  anchorOnlyDiffMode: false,
  anchors: [{ leftLineNo: 1, rightLineNo: 2 }],
  engine: ["auto", "wasm", "build-1"] as const,
  ignoreLeadingWhitespace: false,
  leftLeadingWhitespaceEligible: true,
  leftModelVersionId: 4,
  rightLeadingWhitespaceEligible: true,
  rightModelVersionId: 7,
};

describe("buildDiffContentCacheKey", () => {
  it("reuses the key while only editor layout changes", () => {
    expect(buildDiffContentCacheKey(base)).toBe(buildDiffContentCacheKey({ ...base }));
  });

  it("invalidates for model, option, anchor, or engine changes", () => {
    const key = buildDiffContentCacheKey(base);

    expect(buildDiffContentCacheKey({ ...base, leftModelVersionId: 5 })).not.toBe(key);
    expect(buildDiffContentCacheKey({ ...base, ignoreLeadingWhitespace: true })).not.toBe(key);
    expect(
      buildDiffContentCacheKey({
        ...base,
        anchors: [{ leftLineNo: 2, rightLineNo: 2 }],
      }),
    ).not.toBe(key);
    expect(
      buildDiffContentCacheKey({ ...base, engine: ["auto", "ts", null] }),
    ).not.toBe(key);
  });
});
