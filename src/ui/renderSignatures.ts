function signatureArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export function shouldApplyBySignature(
  currentSignatures: readonly string[],
  nextSignatures: readonly string[],
  currentIds: readonly string[],
  options?: {
    force?: boolean;
    currentModelVersionId?: number;
    nextModelVersionId?: number;
  },
): boolean {
  if (options?.force) {
    return true;
  }
  if (
    options?.currentModelVersionId !== undefined &&
    options.nextModelVersionId !== undefined &&
    options.currentModelVersionId !== options.nextModelVersionId
  ) {
    return true;
  }
  if (!signatureArraysEqual(currentSignatures, nextSignatures)) {
    return true;
  }
  return currentIds.length === 0 && nextSignatures.length > 0;
}
