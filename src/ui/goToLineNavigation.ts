export function moveSelectedIndex(
  currentIndex: number,
  delta: number,
  length: number,
): number {
  if (length <= 0) {
    return -1;
  }
  const next = Math.min(Math.max(currentIndex + delta, 0), length - 1);
  return next;
}

export function resolveGoToLineMoveDelta(event: KeyboardEvent): number | null {
  if (event.key === "ArrowLeft") {
    return -1;
  }
  if (event.key === "ArrowRight") {
    return 1;
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "j" || event.code === "KeyJ") {
    return -1;
  }
  if (key === "k" || event.code === "KeyK") {
    return 1;
  }
  return null;
}

export function handleGoToLineFileMoveShortcut(
  event: KeyboardEvent,
  options: { isOpen: boolean; move: (delta: number) => void },
): boolean {
  if (!options.isOpen) {
    return false;
  }
  const delta = resolveGoToLineMoveDelta(event);
  if (delta === null) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  options.move(delta);
  return true;
}
