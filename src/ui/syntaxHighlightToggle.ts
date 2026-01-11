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
