type AnchorToggleElements = {
  panel: HTMLElement;
  body: HTMLElement;
  toggle: HTMLButtonElement;
};

type AnchorPanelToggleOptions = {
  initialCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
};

function getAnchorToggleElements(root: ParentNode): AnchorToggleElements | null {
  const panel = root.querySelector<HTMLElement>(".anchor-panel");
  const body = root.querySelector<HTMLElement>("#anchor-panel-body");
  const toggle = root.querySelector<HTMLButtonElement>("#anchor-toggle");
  if (!panel || !body || !toggle) {
    return null;
  }
  return { panel, body, toggle };
}

function applyCollapsedState(
  elements: AnchorToggleElements,
  collapsed: boolean,
): void {
  const { panel, body, toggle } = elements;
  panel.classList.toggle("is-collapsed", collapsed);
  body.hidden = collapsed;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.textContent = collapsed ? "展開" : "折りたたみ";
}

export function setupAnchorPanelToggle(
  root: ParentNode = document,
  options: AnchorPanelToggleOptions = {},
): void {
  const elements = getAnchorToggleElements(root);
  if (!elements) {
    return;
  }

  const { panel, toggle } = elements;
  const initialCollapsed = options.initialCollapsed ?? false;
  applyCollapsedState(elements, initialCollapsed);

  toggle.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("is-collapsed");
    applyCollapsedState(elements, collapsed);
    options.onToggle?.(collapsed);
  });
}

export function setAnchorPanelCollapsed(
  root: ParentNode,
  collapsed: boolean,
): void {
  const elements = getAnchorToggleElements(root);
  if (!elements) {
    return;
  }
  applyCollapsedState(elements, collapsed);
}
