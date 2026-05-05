export type PanelVisibilityToggleOptions = {
  root: HTMLElement;
  button: HTMLButtonElement;
  collapseLabel: string;
  expandLabel: string;
  collapsedClass?: string;
  expandedIcon?: string;
  collapsedIcon?: string;
  onToggle?: (collapsed: boolean) => void;
};

const DEFAULT_COLLAPSED_CLASS = "is-fully-collapsed";
const DEFAULT_EXPANDED_ICON = "▾";
const DEFAULT_COLLAPSED_ICON = "▸";

export function bindPanelVisibilityToggle(
  options: PanelVisibilityToggleOptions,
): void {
  const {
    root,
    button,
    collapseLabel,
    expandLabel,
    collapsedClass = DEFAULT_COLLAPSED_CLASS,
    expandedIcon = DEFAULT_EXPANDED_ICON,
    collapsedIcon = DEFAULT_COLLAPSED_ICON,
    onToggle,
  } = options;

  const applyState = (collapsed: boolean): void => {
    root.classList.toggle(collapsedClass, collapsed);
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("aria-label", collapsed ? expandLabel : collapseLabel);
    button.textContent = collapsed ? collapsedIcon : expandedIcon;
  };

  let collapsed = root.classList.contains(collapsedClass);
  applyState(collapsed);

  button.addEventListener("click", () => {
    collapsed = !collapsed;
    applyState(collapsed);
    onToggle?.(collapsed);
  });
}
