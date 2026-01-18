export type FavoritePanelController = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
};

type FavoritePanelOptions = {
  panel: HTMLDivElement;
  overlay: HTMLDivElement;
  addButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  input: HTMLInputElement;
  onReset?: () => void;
};

export function createFavoritePanelController(
  options: FavoritePanelOptions,
): FavoritePanelController {
  const { panel, overlay, addButton, cancelButton, input, onReset } = options;
  const doc = panel.ownerDocument;
  let open = false;

  const applyState = (next: boolean, options?: { focus?: boolean }) => {
    open = next;
    panel.hidden = !next;
    panel.setAttribute("aria-hidden", next ? "false" : "true");
    overlay.hidden = !next;
    overlay.setAttribute("aria-hidden", next ? "false" : "true");
    addButton.setAttribute("aria-expanded", next ? "true" : "false");
    const shouldFocus = options?.focus ?? true;
    if (next) {
      input.value = "";
      onReset?.();
      if (shouldFocus) {
        input.focus();
      }
      return;
    }
    onReset?.();
    if (shouldFocus) {
      addButton.focus();
    }
  };

  const close = () => applyState(false);
  const openPanel = () => applyState(true);

  cancelButton.addEventListener("click", close);
  overlay.addEventListener("click", close);

  doc.addEventListener("keydown", (event) => {
    if (!open) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  applyState(false, { focus: false });

  return {
    open: openPanel,
    close,
    toggle: () => applyState(!open),
    isOpen: () => open,
  };
}
