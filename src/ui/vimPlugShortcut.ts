export type VimPlugShortcutAction = "enable" | "disable";

type VimPlugShortcutState = {
  waitingForCommand: boolean;
};

type VimPlugShortcutContext = {
  getHref: () => string;
  open: (href: string) => void;
};

type VimPlugShortcutBinding = VimPlugShortcutContext & {
  keyTarget: Pick<Window, "addEventListener" | "removeEventListener">;
};

export function createVimPlugShortcutState(): VimPlugShortcutState {
  return { waitingForCommand: false };
}

function isPrefix(event: KeyboardEvent): boolean {
  if (!event.ctrlKey || !event.altKey || event.metaKey || event.shiftKey) {
    return false;
  }
  return event.key.toLowerCase() === "v" || event.code === "KeyV";
}

function getAction(event: KeyboardEvent): VimPlugShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }
  if (event.key === ":") {
    return "enable";
  }
  if (event.key.toLowerCase() === "q" || event.code === "KeyQ") {
    return "disable";
  }
  return null;
}

function isPlugEnabled(href: string): boolean {
  return new URL(href).searchParams.get("entry")?.trim().toLowerCase() === "plug";
}

export function createVimPlugUrl(
  href: string,
  action: VimPlugShortcutAction,
): string {
  const url = new URL(href);
  if (action === "enable") {
    url.searchParams.set("entry", "plug");
  } else {
    url.searchParams.delete("entry");
  }
  return url.toString();
}

export function handleVimPlugShortcut(
  event: KeyboardEvent,
  state: VimPlugShortcutState,
  context: VimPlugShortcutContext,
): boolean {
  if (isPrefix(event)) {
    event.preventDefault();
    if (!event.repeat) {
      state.waitingForCommand = true;
    }
    return true;
  }

  if (!state.waitingForCommand) {
    return false;
  }

  const action = getAction(event);
  state.waitingForCommand = false;
  if (!action) {
    return false;
  }

  event.preventDefault();
  const href = context.getHref();
  const enabled = isPlugEnabled(href);
  if ((action === "enable" && enabled) || (action === "disable" && !enabled)) {
    return true;
  }
  context.open(createVimPlugUrl(href, action));
  return true;
}

export function bindVimPlugShortcut(options: VimPlugShortcutBinding): () => void {
  const state = createVimPlugShortcutState();
  const handleKeydown = (event: Event) => {
    if (
      handleVimPlugShortcut(
        event as KeyboardEvent,
        state,
        options,
      )
    ) {
      event.stopPropagation();
    }
  };

  // 裏モードのEx入口: Ctrl+Alt+V の後に ":" で plug-in、"q" で quit。
  options.keyTarget.addEventListener("keydown", handleKeydown, { capture: true });
  return () => {
    options.keyTarget.removeEventListener("keydown", handleKeydown, {
      capture: true,
    });
  };
}
