export type ReportMode = "simple" | "rich";

type ReportModeMenuOptions = {
  triggerButton: HTMLButtonElement | null;
  menu: HTMLDivElement | null;
  simpleButton: HTMLButtonElement | null;
  richButton: HTMLButtonElement | null;
  initialMode?: ReportMode;
  onChange?: (mode: ReportMode) => void;
};

type ReportModeMenuController = {
  getMode: () => ReportMode;
  setMode: (mode: ReportMode) => void;
  isOpen: () => boolean;
  close: () => void;
};

function getModeLabel(mode: ReportMode): string {
  return mode === "simple" ? "シンプル" : "リッチ";
}

export function bindReportModeMenu(
  options: ReportModeMenuOptions,
): ReportModeMenuController {
  const {
    triggerButton,
    menu,
    simpleButton,
    richButton,
    initialMode = "simple",
    onChange,
  } = options;

  let mode: ReportMode = initialMode;
  let open = false;

  if (!triggerButton || !menu || !simpleButton || !richButton) {
    return {
      getMode: () => mode,
      setMode: (next) => {
        mode = next;
      },
      isOpen: () => false,
      close: () => undefined,
    };
  }

  const root = triggerButton.closest(".report-export-control");
  const doc = triggerButton.ownerDocument;

  const setOpen = (next: boolean) => {
    open = next;
    menu.hidden = !next;
    triggerButton.setAttribute("aria-expanded", next ? "true" : "false");
  };

  const applyMode = (next: ReportMode, silent = false) => {
    mode = next;
    const simpleSelected = next === "simple";
    simpleButton.classList.toggle("is-selected", simpleSelected);
    richButton.classList.toggle("is-selected", !simpleSelected);
    simpleButton.setAttribute("aria-checked", simpleSelected ? "true" : "false");
    richButton.setAttribute("aria-checked", simpleSelected ? "false" : "true");
    triggerButton.setAttribute("title", `出力モード: ${getModeLabel(next)}`);
    if (!silent) {
      onChange?.(next);
    }
  };

  const selectMode = (next: ReportMode) => {
    applyMode(next);
    setOpen(false);
  };

  triggerButton.addEventListener("click", (event) => {
    event.preventDefault();
    setOpen(!open);
  });

  simpleButton.addEventListener("click", (event) => {
    event.preventDefault();
    selectMode("simple");
  });

  richButton.addEventListener("click", (event) => {
    event.preventDefault();
    selectMode("rich");
  });

  doc.addEventListener("click", (event) => {
    if (!open) {
      return;
    }
    const target = event.target as Node | null;
    if (target && root?.contains(target)) {
      return;
    }
    setOpen(false);
  });

  doc.addEventListener("keydown", (event) => {
    if (!open) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  });

  applyMode(mode, true);
  setOpen(false);

  return {
    getMode: () => mode,
    setMode: (next) => applyMode(next),
    isOpen: () => open,
    close: () => setOpen(false),
  };
}
