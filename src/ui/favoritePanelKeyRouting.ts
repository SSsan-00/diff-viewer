export function shouldFocusFavoriteInput(
  event: KeyboardEvent,
  options: { inputHasFocus: boolean },
): boolean {
  if (options.inputHasFocus) {
    return false;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  if (event.key === "Escape" || event.key === "Enter" || event.key === "Tab") {
    return false;
  }
  if (event.key === "Backspace") {
    return true;
  }
  return event.key.length === 1;
}

export function focusFavoriteInputOnKey(
  event: KeyboardEvent,
  input: HTMLInputElement,
): boolean {
  const inputHasFocus = input === input.ownerDocument.activeElement;
  if (!shouldFocusFavoriteInput(event, { inputHasFocus })) {
    return false;
  }
  input.focus();
  return true;
}
