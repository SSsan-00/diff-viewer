export function clampFavoriteFocusIndex(
  current: number | null,
  length: number,
): number | null {
  if (length <= 0) {
    return null;
  }
  if (current === null) {
    return null;
  }
  if (current < 0) {
    return 0;
  }
  return Math.min(current, length - 1);
}

export function moveFavoriteFocusIndex(
  current: number | null,
  delta: number,
  length: number,
): number | null {
  if (length <= 0) {
    return null;
  }
  if (current === null) {
    return 0;
  }
  const next = current + delta;
  return Math.min(Math.max(next, 0), length - 1);
}

export function resolveFavoriteMoveDelta(event: KeyboardEvent): number | null {
  if (event.key === "ArrowUp") {
    return -1;
  }
  if (event.key === "ArrowDown") {
    return 1;
  }
  return null;
}

export function handleFavoriteListKeydown(
  event: KeyboardEvent,
  options: {
    length: number;
    currentIndex: number | null;
    onMove: (nextIndex: number | null) => void;
    onCopy: (index: number) => void;
    onRemove: (index: number) => void;
  },
): boolean {
  const delta = resolveFavoriteMoveDelta(event);
  if (delta !== null) {
    event.preventDefault();
    event.stopPropagation();
    const next = moveFavoriteFocusIndex(
      options.currentIndex,
      delta,
      options.length,
    );
    options.onMove(next);
    return true;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (
      options.currentIndex !== null &&
      options.currentIndex >= 0 &&
      options.currentIndex < options.length
    ) {
      options.onCopy(options.currentIndex);
    }
    return true;
  }

  if (event.key === "Delete") {
    event.preventDefault();
    event.stopPropagation();
    if (
      options.currentIndex !== null &&
      options.currentIndex >= 0 &&
      options.currentIndex < options.length
    ) {
      options.onRemove(options.currentIndex);
    }
    return true;
  }

  return false;
}
