type IgnoreLeadingWhitespaceToggleOptions = {
  input: HTMLInputElement | null;
  initialEnabled?: boolean;
  onChange?: (enabled: boolean) => void;
  onAfterToggle?: () => void;
};

export function bindIgnoreLeadingWhitespaceToggle(
  options: IgnoreLeadingWhitespaceToggleOptions,
): { apply: (enabled: boolean) => void } | null {
  const { input, onChange, onAfterToggle } = options;
  if (!input) {
    return null;
  }

  let enabled = options.initialEnabled ?? false;
  input.checked = enabled;

  const apply = (nextEnabled: boolean) => {
    enabled = nextEnabled;
    input.checked = enabled;
    onChange?.(enabled);
    onAfterToggle?.();
  };

  input.addEventListener("change", () => {
    apply(input.checked);
  });

  return { apply };
}
