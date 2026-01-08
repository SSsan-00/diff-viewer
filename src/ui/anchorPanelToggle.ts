type AnchorToggleElements = {
  panel: HTMLElement;
  body: HTMLElement;
  toggle: HTMLInputElement;
};

type AnchorPanelToggleOptions = {
  initialCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
};

function getAnchorToggleElements(root: ParentNode): AnchorToggleElements | null {
  const panel = root.querySelector<HTMLElement>(".anchor-panel");
  const body = root.querySelector<HTMLElement>("#anchor-panel-body");
  const toggle = root.querySelector<HTMLInputElement>("#anchor-toggle");
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
  toggle.checked = collapsed;
}

export function setupAnchorPanelToggle(
  root: ParentNode = document,
  options: AnchorPanelToggleOptions = {},
): void {
  const elements = getAnchorToggleElements(root);
  if (!elements) {
    return;
  }

  const { toggle } = elements;
  const initialCollapsed = options.initialCollapsed ?? false;
  applyCollapsedState(elements, initialCollapsed);

  toggle.addEventListener("change", () => {
    const collapsed = toggle.checked;
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
