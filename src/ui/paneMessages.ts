export function setPaneMessage(
  target: HTMLDivElement,
  message: string,
  isError: boolean,
): void {
  target.textContent = message;
  target.classList.toggle("is-error", isError);
}

export function clearPaneMessage(target: HTMLDivElement): void {
  setPaneMessage(target, "", false);
}
