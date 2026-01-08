export function updateDiffJumpButtons(
  prevButton: HTMLButtonElement | null,
  nextButton: HTMLButtonElement | null,
  hasDiffs: boolean,
): void {
  if (prevButton) {
    prevButton.disabled = !hasDiffs;
  }
  if (nextButton) {
    nextButton.disabled = !hasDiffs;
  }
}
