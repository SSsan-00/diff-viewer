export function renderFileCards(
  container: HTMLElement,
  names: readonly string[],
): void {
  const doc = container.ownerDocument;
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
