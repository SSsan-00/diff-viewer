type WordWrapEditor = {
  updateOptions: (options: { wordWrap: "on" | "off" }) => void;
  layout: () => void;
};

type FrameRequest = (callback: FrameRequestCallback) => number;

type WordWrapToggleOptions = {
  input: HTMLInputElement | null;
  editors: WordWrapEditor[];
  onAfterToggle?: () => void;
  requestFrame?: FrameRequest;
};

export function bindWordWrapToggle(options: WordWrapToggleOptions): void {
  const { input, editors, onAfterToggle } = options;
  const requestFrame = options.requestFrame ?? requestAnimationFrame;

  if (!input) {
    return;
  }

  let pending = false;

  const applyWrap = (next: "on" | "off") => {
    editors.forEach((editor) => {
      editor.updateOptions({
        wordWrap: next,
        wrappingStrategy: "advanced",
        lineHeight: 22,
      });
      editor.layout();
    });
    if (pending) {
      return;
    }
    pending = true;
    requestFrame(() => {
      requestFrame(() => {
        pending = false;
        onAfterToggle?.();
      });
    });
  };

  const handleToggle = () => {
    const next = input.checked ? "on" : "off";
    applyWrap(next);
  };

  input.addEventListener("change", handleToggle);
}
