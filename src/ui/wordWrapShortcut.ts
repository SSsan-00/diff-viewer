type WordWrapEditor = {
  updateOptions: (options: { wordWrap: "on" | "off" }) => void;
  layout: () => void;
};

type FrameRequest = (callback: FrameRequestCallback) => number;

type WordWrapShortcutOptions = {
  editors: WordWrapEditor[];
  getEnabled: () => boolean;
  setEnabled: (next: boolean) => void;
  onAfterToggle?: () => void;
  requestFrame?: FrameRequest;
  keyTarget?: Document | Window;
};

export function bindWordWrapShortcut(options: WordWrapShortcutOptions): void {
  const {
    editors,
    getEnabled,
    setEnabled,
    onAfterToggle,
    requestFrame = requestAnimationFrame,
    keyTarget = window,
  } = options;

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

  keyTarget.addEventListener("keydown", (event) => {
    if (!event.altKey) {
      return;
    }
    if (event.key !== "z" && event.key !== "Z" && event.code !== "KeyZ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextEnabled = !getEnabled();
    setEnabled(nextEnabled);
    applyWrap(nextEnabled ? "on" : "off");
  });
}
