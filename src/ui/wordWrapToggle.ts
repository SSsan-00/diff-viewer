type WordWrapEditor = {
  updateOptions: (options: { wordWrap: "on" | "off" }) => void;
  layout: () => void;
};

type FrameRequest = (callback: FrameRequestCallback) => number;

export function bindWordWrapToggle(
  input: HTMLInputElement | null,
  editor: WordWrapEditor,
  onAfterToggle?: () => void,
  requestFrame: FrameRequest = requestAnimationFrame,
): void {
  if (!input) {
    return;
  }

  let pending = false;

  input.addEventListener("change", () => {
    const next = input.checked ? "on" : "off";
    editor.updateOptions({ wordWrap: next });
    editor.layout();
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
  });
}
