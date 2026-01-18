export type WorkspacePanelController = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
};

type WorkspacePanelOptions = {
  panel: HTMLDivElement;
  overlay: HTMLDivElement;
  toggleButton: HTMLButtonElement;
  onReset?: () => void;
};

export function createWorkspacePanelController(
  options: WorkspacePanelOptions,
): WorkspacePanelController {
  const { panel, overlay, toggleButton, onReset } = options;
  const doc = panel.ownerDocument;
  let open = false;

  const applyState = (next: boolean, options?: { focus?: boolean }) => {
    open = next;
    panel.hidden = !next;
    panel.setAttribute("aria-hidden", next ? "false" : "true");
    overlay.hidden = !next;
    overlay.setAttribute("aria-hidden", next ? "false" : "true");
    toggleButton.setAttribute("aria-expanded", next ? "true" : "false");
    const shouldFocus = options?.focus ?? true;
    if (next) {
      onReset?.();
      if (shouldFocus) {
        toggleButton.focus();
      }
      return;
    }
    onReset?.();
    if (shouldFocus) {
      toggleButton.focus();
    }
  };

  const close = () => applyState(false);
  const openPanel = () => applyState(true);

  toggleButton.addEventListener("click", () => applyState(!open));
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
