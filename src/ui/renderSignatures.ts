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
  options?: { force?: boolean },
): boolean {
  if (options?.force) {
    return true;
  }
  if (!signatureArraysEqual(currentSignatures, nextSignatures)) {
    return true;
  }
  return currentIds.length === 0 && nextSignatures.length > 0;
}
