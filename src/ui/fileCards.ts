export function renderFileCards(
  container: HTMLElement,
  names: readonly string[],
): void {
  const doc = container.ownerDocument;
  container.dataset.hasFiles = names.length > 0 ? "true" : "false";
  container.setAttribute("aria-hidden", names.length === 0 ? "true" : "false");
  container.textContent = "";

  const fragment = doc.createDocumentFragment();
  for (const name of names) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "file-card";
    button.textContent = name;
    button.title = name;
    button.setAttribute("aria-label", name);
    button.dataset.file = name;
    fragment.appendChild(button);
  }

  container.appendChild(fragment);
}

function hasLoadedFiles(container: HTMLElement): boolean {
  return container.dataset.hasFiles === "true";
}

export function syncFileCards(
  left: HTMLDivElement,
  right: HTMLDivElement,
): void {
  const showBars = hasLoadedFiles(left) || hasLoadedFiles(right);
  left.style.display = showBars ? "flex" : "none";
  right.style.display = showBars ? "flex" : "none";
}
