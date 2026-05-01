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

function hasPaneMessage(target: HTMLDivElement): boolean {
  return (target.textContent ?? "").length > 0;
}

export function syncPaneMessages(
  left: HTMLDivElement,
  right: HTMLDivElement,
): void {
  const targets = [left, right];
  for (const target of targets) {
    target.style.display = "block";
    target.style.minHeight = "0px";
  }

  if (!hasPaneMessage(left) && !hasPaneMessage(right)) {
    for (const target of targets) {
      target.style.display = "none";
      target.style.minHeight = "0px";
    }
    return;
  }

  const reservedHeight = Math.max(
    hasPaneMessage(left) ? left.scrollHeight : 0,
    hasPaneMessage(right) ? right.scrollHeight : 0,
  );
  const nextMinHeight = `${reservedHeight}px`;
  for (const target of targets) {
    target.style.display = "block";
    target.style.minHeight = nextMinHeight;
  }
}
