export function resolveAnchorMoveDelta(event: KeyboardEvent): number | null {
  if (event.key === "ArrowUp") {
    return -1;
  }
  if (event.key === "ArrowDown") {
    return 1;
  }
  return null;
}

export function getNextAnchorKey(
  keys: readonly string[],
  selectedKey: string,
  delta: number,
): string | null {
  if (keys.length === 0) {
    return null;
  }
  const currentIndex = keys.indexOf(selectedKey);
  if (currentIndex === -1) {
    return null;
  }
  const nextIndex = Math.min(
    Math.max(currentIndex + delta, 0),
    keys.length - 1,
  );
  return keys[nextIndex] ?? null;
}
