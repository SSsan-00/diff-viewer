export type EditorSide = "left" | "right";

export type FindAction = {
  run: () => void;
};

export type EditorFindLike = {
  hasTextFocus?: () => boolean;
  getAction: (id: string) => FindAction | null;
  trigger?: (source: string, id: string, payload: unknown) => void;
  focus?: () => void;
};

type FindContext = {
  left: EditorFindLike;
  right: EditorFindLike;
  getLastFocused: () => EditorSide;
};

function isFindShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  return event.key.toLowerCase() === "f" || event.code === "KeyF";
}

function resolveActiveSide(context: FindContext): EditorSide {
  if (context.left.hasTextFocus?.()) {
    return "left";
  }
  if (context.right.hasTextFocus?.()) {
    return "right";
  }
  return context.getLastFocused();
}

function runFind(editor: EditorFindLike): boolean {
  editor.focus?.();
  const action = editor.getAction("actions.find");
  if (!action) {
    if (editor.trigger) {
      editor.trigger("keyboard", "actions.find", null);
      return true;
    }
    return false;
  }
  action.run();
  return true;
}

export function handleFindShortcut(
  event: KeyboardEvent,
  context: FindContext,
): boolean {
  if (!isFindShortcut(event)) {
    return false;
  }
  event.preventDefault();
  const side = resolveActiveSide(context);
  const target = side === "left" ? context.left : context.right;
  return runFind(target);
}
