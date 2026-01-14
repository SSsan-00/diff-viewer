export function bindFileCardJump(
  container: HTMLElement,
  onJump: (fileName: string) => void,
): void {
  container.addEventListener("click", (event) => {
    const target = event.target;
    const view = container.ownerDocument.defaultView;
    if (!view || !(target instanceof view.HTMLElement)) {
      return;
    }
    const card = target.closest<HTMLButtonElement>("button.file-card");
    if (!card) {
      return;
    }
    const fileName = card.dataset.file;
    if (!fileName) {
      return;
    }
    onJump(fileName);
  });
}
