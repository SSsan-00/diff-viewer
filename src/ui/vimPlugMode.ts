import { initVimMode, VimMode } from "monaco-vim";
import type * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { goToLikelyDefinition } from "./vimDefinition";
import { registerVimPlugCommands } from "./vimCommands";
import type { VimEditorMode, VimPaneSide } from "./vimPaneNavigation";

type VimAdapter = ReturnType<typeof initVimMode>;

type VimCommandApi = Parameters<typeof registerVimPlugCommands>[0];

type VimPlugModeOptions = {
  appRoot: HTMLElement;
  editors: Record<VimPaneSide, monaco.editor.IStandaloneCodeEditor>;
  getSideForEditor: (
    editor: monaco.editor.IStandaloneCodeEditor,
  ) => VimPaneSide | null;
  panes: Record<VimPaneSide, HTMLElement>;
  savePane: (side: VimPaneSide) => Promise<void>;
  showMessage: (message: string, type?: "error") => void;
};

export type VimPlugModeController = {
  dispose: () => void;
  getMode: (side: VimPaneSide) => VimEditorMode;
};

let commandsRegistered = false;

function normalizeMode(mode: string | undefined): VimEditorMode {
  const normalized = mode?.toLowerCase() ?? "";
  if (normalized.includes("insert")) {
    return "insert";
  }
  if (normalized.includes("visual")) {
    return "visual";
  }
  if (normalized.includes("normal")) {
    return "normal";
  }
  return "unknown";
}

function createStatusNode(side: VimPaneSide, pane: HTMLElement): HTMLElement {
  const node = document.createElement("div");
  node.className = "vim-plug-status";
  node.setAttribute("aria-label", `${side} Vim status`);
  pane.appendChild(node);
  return node;
}

function getVimCommandApi(): VimCommandApi {
  const api = (VimMode as unknown as { Vim?: VimCommandApi }).Vim;
  if (!api) {
    throw new Error("Vim command API is unavailable.");
  }
  return api;
}

export function setupVimPlugMode(
  options: VimPlugModeOptions,
): VimPlugModeController {
  const modes: Record<VimPaneSide, VimEditorMode> = {
    left: "normal",
    right: "normal",
  };
  const statusNodes: Record<VimPaneSide, HTMLElement> = {
    left: createStatusNode("left", options.panes.left),
    right: createStatusNode("right", options.panes.right),
  };

  if (!commandsRegistered) {
    registerVimPlugCommands(getVimCommandApi(), {
      goToDefinition: (editor) => {
        const target = editor as monaco.editor.IStandaloneCodeEditor | undefined;
        if (!target || !goToLikelyDefinition(target)) {
          options.showMessage("定義候補が見つかりませんでした。", "error");
        }
      },
      writeAll: () => {
        void (async () => {
          await options.savePane("left");
          await options.savePane("right");
        })();
      },
      writeFocused: (editor) => {
        const target = editor as monaco.editor.IStandaloneCodeEditor | undefined;
        const side = target ? options.getSideForEditor(target) : null;
        if (!side) {
          options.showMessage("保存対象のペインを特定できませんでした。", "error");
          return;
        }
        void options.savePane(side);
      },
    });
    commandsRegistered = true;
  }

  const adapters: Record<VimPaneSide, VimAdapter> = {
    left: initVimMode(options.editors.left, statusNodes.left),
    right: initVimMode(options.editors.right, statusNodes.right),
  };

  (Object.keys(adapters) as VimPaneSide[]).forEach((side) => {
    adapters[side].on("vim-mode-change", (event: { mode?: string }) => {
      modes[side] = normalizeMode(event.mode);
    });
  });

  options.appRoot.dataset.vim = "plug";

  return {
    dispose: () => {
      adapters.left.dispose();
      adapters.right.dispose();
      statusNodes.left.remove();
      statusNodes.right.remove();
      delete options.appRoot.dataset.vim;
    },
    getMode: (side) => modes[side],
  };
}
