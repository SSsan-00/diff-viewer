export type ThemeMode = "light" | "dark";

type ThemeToggleOptions = {
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  storageKey?: string;
  onThemeChange?: (mode: ThemeMode) => void;
};

const DEFAULT_STORAGE_KEY = "diff-viewer:theme";

function getThemeRoot(root: ParentNode): HTMLElement | null {
  const doc = root as Document;
  if (doc.documentElement) {
    return doc.documentElement;
  }
  if (typeof HTMLElement !== "undefined" && root instanceof HTMLElement) {
    return root;
  }
  return null;
}

function normalizeTheme(value: string | null): ThemeMode {
  return value === "dark" ? "dark" : "light";
}

function applyTheme(root: ParentNode, mode: ThemeMode): void {
  const target = getThemeRoot(root);
  if (!target) {
    return;
  }
  target.dataset.theme = mode;
}

export function setupThemeToggle(
  root: ParentNode = document,
  options: ThemeToggleOptions = {},
): ThemeMode | null {
  const toggle = root.querySelector<HTMLInputElement>("#theme-toggle");
  if (!toggle) {
    return null;
  }
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const stored = options.storage?.getItem(storageKey) ?? null;
  const initial = normalizeTheme(stored);

  toggle.checked = initial === "dark";
  toggle.setAttribute("aria-checked", toggle.checked ? "true" : "false");
  applyTheme(root, initial);
  options.onThemeChange?.(initial);

  toggle.addEventListener("change", () => {
    const mode: ThemeMode = toggle.checked ? "dark" : "light";
    toggle.setAttribute("aria-checked", toggle.checked ? "true" : "false");
    applyTheme(root, mode);
    options.storage?.setItem(storageKey, mode);
    options.onThemeChange?.(mode);
  });

  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    toggle.checked = !toggle.checked;
    const view = toggle.ownerDocument?.defaultView;
    const changeEvent = view
      ? new view.Event("change", { bubbles: true })
      : new Event("change");
    toggle.dispatchEvent(changeEvent);
  });

  return initial;
}
