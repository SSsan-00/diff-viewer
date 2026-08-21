export type DiffContentCacheKeyInput = {
  anchorOnlyDiffMode: boolean;
  anchors: ReadonlyArray<{ leftLineNo: number; rightLineNo: number }>;
  engine: readonly [requestedMode: string, activeMode: string, buildId: string | null];
  ignoreLeadingWhitespace: boolean;
  leftLeadingWhitespaceEligible: boolean;
  leftModelVersionId: number;
  rightLeadingWhitespaceEligible: boolean;
  rightModelVersionId: number;
};

export function buildDiffContentCacheKey(input: DiffContentCacheKeyInput): string {
  return JSON.stringify([
    input.leftModelVersionId,
    input.rightModelVersionId,
    input.ignoreLeadingWhitespace,
    input.leftLeadingWhitespaceEligible,
    input.rightLeadingWhitespaceEligible,
    input.anchorOnlyDiffMode,
    input.anchors.map((anchor) => [anchor.leftLineNo, anchor.rightLineNo]),
    input.engine,
  ]);
}
