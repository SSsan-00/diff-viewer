import type { VimViewportPlacement } from "./vimViewportMotion";

type VimCommandApi = {
  defineAction: (
    name: string,
    callback: (cm: { editor?: unknown }) => void,
  ) => void;
  defineEx: (
    name: string,
    prefix: string,
    callback: (cm: { editor?: unknown }) => void,
  ) => void;
  mapCommand: (
    keys: string,
    type: "action",
    name: string,
    args?: unknown,
    extra?: Record<string, unknown>,
  ) => void;
};

export type VimPlugCommandContext = {
  goToDefinition: (editor: unknown) => void;
  jumpToMatchingBracket: (editor: unknown) => void;
  moveToViewportLine: (editor: unknown, placement: VimViewportPlacement) => void;
  writeAll: () => void;
  writeFocused: (editor: unknown) => void;
};

export function registerVimPlugCommands(
  vim: VimCommandApi,
  context: VimPlugCommandContext,
): void {
  vim.defineAction("diffViewerGoToDefinition", (cm) => {
    context.goToDefinition(cm.editor);
  });
  vim.mapCommand("gd", "action", "diffViewerGoToDefinition", {}, {
    context: "normal",
  });
  vim.defineAction("diffViewerJumpToMatchingBracket", (cm) => {
    context.jumpToMatchingBracket(cm.editor);
  });
  vim.mapCommand("%", "action", "diffViewerJumpToMatchingBracket", {}, {
    context: "normal",
  });
  (
    [
      ["H", "top"],
      ["M", "middle"],
      ["L", "bottom"],
    ] as const
  ).forEach(([keys, placement]) => {
    const name = `diffViewerViewport${placement[0].toUpperCase()}${placement.slice(1)}`;
    vim.defineAction(name, (cm) => {
      context.moveToViewportLine(cm.editor, placement);
    });
    vim.mapCommand(keys, "action", name, {}, { context: "normal" });
  });
  vim.defineEx("write", "w", (cm) => {
    context.writeFocused(cm.editor);
  });
  vim.defineEx("wall", "wa", () => {
    context.writeAll();
  });
}
