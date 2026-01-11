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
  keyTarget?: Document | Window;
};

export function bindWordWrapToggle(options: WordWrapToggleOptions): void {
  const { input, editors, onAfterToggle } = options;
  const requestFrame = options.requestFrame ?? requestAnimationFrame;
  const keyTarget = options.keyTarget ?? window;

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

  keyTarget.addEventListener("keydown", (event) => {
    if (!event.altKey) {
      return;
    }
    if (event.key !== "z" && event.key !== "Z") {
      return;
    }
    event.preventDefault();
    input.checked = !input.checked;
    handleToggle();
  });
}
