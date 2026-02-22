export type SyntaxHighlightEditor = {
  getModel: () => object | null;
};

export type SyntaxHighlightToggleOptions = {
  input: HTMLInputElement | null;
  button?: HTMLButtonElement | null;
  editors: SyntaxHighlightEditor[];
  getLanguageForEditor: (index: number) => string;
  setModelLanguage: (model: object, language: string) => void;
  onAfterToggle?: () => void;
  initialEnabled?: boolean;
};

function applyHighlightState(root: ParentNode, enabled: boolean): void {
  const doc = root as Document;
  const target = doc.documentElement ?? (root as HTMLElement);
  if (!target) {
    return;
  }
  target.dataset.highlight = enabled ? "on" : "off";
}

function applyHighlightButtonState(
  button: HTMLButtonElement | null | undefined,
  enabled: boolean,
): void {
  if (!button) {
    return;
  }
  button.setAttribute("aria-pressed", enabled ? "true" : "false");
}

function dispatchInputChange(input: HTMLInputElement): void {
  const view = input.ownerDocument?.defaultView;
  const changeEvent = view
    ? new view.Event("change", { bubbles: true })
    : new Event("change");
  input.dispatchEvent(changeEvent);
}

export function bindSyntaxHighlightToggle(
  options: SyntaxHighlightToggleOptions,
): { applyHighlight: (enabled: boolean) => void } | null {
  const { input, button, editors, getLanguageForEditor, setModelLanguage, onAfterToggle } =
    options;

  if (!input) {
    return null;
  }

  let enabled = options.initialEnabled ?? true;
  input.checked = enabled;
  applyHighlightButtonState(button, enabled);

  const applyHighlight = (nextEnabled: boolean) => {
    enabled = nextEnabled;
    input.checked = enabled;
    applyHighlightButtonState(button, enabled);
    applyHighlightState(input.ownerDocument ?? document, enabled);
    editors.forEach((editor, index) => {
      const model = editor.getModel();
      if (!model) {
        return;
      }
      const language = enabled ? getLanguageForEditor(index) : "plaintext";
      setModelLanguage(model, language);
    });
    onAfterToggle?.();
  };

  const handleToggle = () => {
    applyHighlight(input.checked);
  };

  const handleButtonClick = () => {
    input.checked = !input.checked;
    dispatchInputChange(input);
  };

  input.addEventListener("change", handleToggle);
  button?.addEventListener("click", handleButtonClick);

  return { applyHighlight };
}
