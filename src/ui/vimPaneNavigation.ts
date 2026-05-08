export type VimPaneSide = "left" | "right";
export type VimEditorMode = "normal" | "insert" | "visual" | "unknown";

type VimPaneNavigationState = {
  waitingForWindowTarget: boolean;
};

type VimPaneNavigationContext = {
  enabled: boolean;
  getFocusedSide: () => VimPaneSide | null;
  getMode: (side: VimPaneSide) => VimEditorMode;
  focusPane: (side: VimPaneSide) => void;
};

export function createVimPaneNavigationState(): VimPaneNavigationState {
  return { waitingForWindowTarget: false };
}

function isCtrlW(event: KeyboardEvent): boolean {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    return false;
  }
  return event.key.toLowerCase() === "w" || event.code === "KeyW";
}

function getTargetSide(event: KeyboardEvent): VimPaneSide | null {
  const key = event.key.toLowerCase();
  if (key === "h" || event.code === "KeyH") {
    return "left";
  }
  if (key === "l" || event.code === "KeyL") {
    return "right";
  }
  return null;
}

function canHandleWindowCommand(context: VimPaneNavigationContext): boolean {
  if (!context.enabled) {
    return false;
  }
  const focused = context.getFocusedSide();
  return !!focused && context.getMode(focused) === "normal";
}

export function handleVimPaneNavigation(
  event: KeyboardEvent,
  state: VimPaneNavigationState,
  context: VimPaneNavigationContext,
): boolean {
  if (isCtrlW(event)) {
    if (!canHandleWindowCommand(context)) {
      state.waitingForWindowTarget = false;
      return false;
    }
    event.preventDefault();
    if (!event.repeat) {
      state.waitingForWindowTarget = true;
    }
    return true;
  }

  if (!state.waitingForWindowTarget) {
    return false;
  }

  state.waitingForWindowTarget = false;
  const side = getTargetSide(event);
  if (!side) {
    return false;
  }

  event.preventDefault();
  context.focusPane(side);
  return true;
}

export function shouldLetVimHandleEditorKey(
  event: KeyboardEvent,
  options: {
    enabled: boolean;
    editorFocused: boolean;
  },
): boolean {
  if (!options.enabled || !options.editorFocused) {
    return false;
  }
  if (event.altKey) {
    return false;
  }
  return event.ctrlKey || event.metaKey;
}
