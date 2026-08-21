import { describe, expect, it } from "vitest";
import { buildPairedOpsSignature, buildSegmentsSignature } from "./diffRenderCacheKey";

describe("diff render cache keys", () => {
  it("does not collide when line text contains the old field separator", () => {
    const first = buildPairedOpsSignature([
      {
        type: "replace",
        leftLineNo: 0,
        rightLineNo: 0,
        leftLine: "foo|bar",
        rightLine: "baz",
      },
    ]);
    const second = buildPairedOpsSignature([
      {
        type: "replace",
        leftLineNo: 0,
        rightLineNo: 0,
        leftLine: "foo",
        rightLine: "bar|baz",
      },
    ]);

    expect(first).not.toBe(second);
  });

  it("does not collide when file names contain separators or newlines", () => {
    const first = buildSegmentsSignature([
      { fileIndex: 0, fileName: "a|b\nc", startLine: 1, lineCount: 2 },
    ]);
    const second = buildSegmentsSignature([
      { fileIndex: 0, fileName: "a", startLine: 1, lineCount: 2 },
      { fileIndex: 0, fileName: "b\nc", startLine: 1, lineCount: 2 },
    ]);

    expect(first).not.toBe(second);
  });
});
