export type SyntaxHighlightEditor = {
  getModel: () => object | null;
};

export type SyntaxHighlightToggleOptions = {
  input: HTMLInputElement | null;
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

export function bindSyntaxHighlightToggle(
  options: SyntaxHighlightToggleOptions,
): { applyHighlight: (enabled: boolean) => void } | null {
  const { input, editors, getLanguageForEditor, setModelLanguage, onAfterToggle } =
    options;

  if (!input) {
    return null;
  }

  let enabled = options.initialEnabled ?? true;
  input.checked = enabled;

  const applyHighlight = (nextEnabled: boolean) => {
    enabled = nextEnabled;
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

  input.addEventListener("change", handleToggle);

  return { applyHighlight };
}
