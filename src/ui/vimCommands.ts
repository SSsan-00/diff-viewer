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
  vim.defineEx("write", "w", (cm) => {
    context.writeFocused(cm.editor);
  });
  vim.defineEx("wall", "wa", () => {
    context.writeAll();
  });
}
