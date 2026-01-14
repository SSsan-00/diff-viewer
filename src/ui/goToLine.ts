import type { EditorSide } from "./editorFind";

type GoToLineContext = {
  left: { hasTextFocus?: () => boolean };
  right: { hasTextFocus?: () => boolean };
  getLastFocused: () => EditorSide;
  open: (side: EditorSide) => void;
  close: (side: EditorSide) => void;
  isOpen: (side: EditorSide) => boolean;
};

function isGoToLineShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  return event.key.toLowerCase() === "g" || event.code === "KeyG";
}

function resolveActiveSide(context: GoToLineContext): EditorSide {
  if (context.left.hasTextFocus?.()) {
    return "left";
  }
  if (context.right.hasTextFocus?.()) {
    return "right";
  }
  return context.getLastFocused();
}

export function handleGoToLineShortcut(
  event: KeyboardEvent,
  context: GoToLineContext,
): boolean {
  if (!isGoToLineShortcut(event)) {
    return false;
  }
  event.preventDefault();
  const side = resolveActiveSide(context);
  if (context.isOpen(side)) {
    context.close(side);
    return true;
  }
  context.open(side);
  return true;
}
