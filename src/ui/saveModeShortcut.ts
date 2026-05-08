export type SaveModeShortcutAction = "enable" | "disable";

type SaveModeShortcutState = {
  buffer: string;
};

type SaveModeShortcutContext = {
  getHref: () => string;
  open: (href: string) => void;
};

type SaveModeShortcutBinding = SaveModeShortcutContext & {
  keyTarget: Pick<Window, "addEventListener" | "removeEventListener">;
};

const SAVE_MODE_ENABLE_SEQUENCE = "999";
const SAVE_MODE_DISABLE_SEQUENCE = "777";

export function createSaveModeShortcutState(): SaveModeShortcutState {
  return { buffer: "" };
}

function getShortcutDigit(event: KeyboardEvent): "7" | "9" | null {
  if (!event.ctrlKey || !event.altKey || event.metaKey || event.shiftKey) {
    return null;
  }
  if (event.key === "7" || event.code === "Digit7" || event.code === "Numpad7") {
    return "7";
  }
  if (event.key === "9" || event.code === "Digit9" || event.code === "Numpad9") {
    return "9";
  }
  return null;
}

function isSaveModeEnabled(href: string): boolean {
  return new URL(href).searchParams.get("save")?.trim().toLowerCase() === "on";
}

export function createSaveModeUrl(
  href: string,
  action: SaveModeShortcutAction,
): string {
  const url = new URL(href);
  if (action === "enable") {
    url.searchParams.set("save", "on");
  } else {
    url.searchParams.delete("save");
  }
  return url.toString();
}

function resolveShortcutAction(buffer: string): SaveModeShortcutAction | null {
  if (buffer === SAVE_MODE_ENABLE_SEQUENCE) {
    return "enable";
  }
  if (buffer === SAVE_MODE_DISABLE_SEQUENCE) {
    return "disable";
  }
  return null;
}

export function handleSaveModeShortcut(
  event: KeyboardEvent,
  state: SaveModeShortcutState,
  context: SaveModeShortcutContext,
): boolean {
  const digit = getShortcutDigit(event);
  if (!digit) {
    state.buffer = "";
    return false;
  }

  event.preventDefault();
  if (event.repeat) {
    return true;
  }

  state.buffer = `${state.buffer}${digit}`.slice(-3);
  const action = resolveShortcutAction(state.buffer);
  if (!action) {
    return true;
  }

  state.buffer = "";
  const href = context.getHref();
  const enabled = isSaveModeEnabled(href);
  if ((action === "enable" && enabled) || (action === "disable" && !enabled)) {
    return true;
  }

  context.open(createSaveModeUrl(href, action));
  return true;
}

export function bindSaveModeShortcut(options: SaveModeShortcutBinding): () => void {
  const state = createSaveModeShortcutState();
  const handleKeydown = (event: Event) => {
    if (
      handleSaveModeShortcut(
        event as KeyboardEvent,
        state,
        options,
      )
    ) {
      event.stopPropagation();
    }
  };

  // 裏コード: Ctrl+Alt+999 / Ctrl+Alt+777 で保存モードを切り替える秘密の入口。
  options.keyTarget.addEventListener("keydown", handleKeydown, { capture: true });
  return () => {
    options.keyTarget.removeEventListener("keydown", handleKeydown, {
      capture: true,
    });
  };
}
