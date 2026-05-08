import { describe, expect, it, vi } from "vitest";
import { registerVimPlugCommands } from "./vimCommands";

describe("Vim plug commands", () => {
  it("registers gd as a normal mode definition jump", () => {
    const vim = {
      defineAction: vi.fn(),
      defineEx: vi.fn(),
      mapCommand: vi.fn(),
    };

    registerVimPlugCommands(vim, {
      goToDefinition: vi.fn(),
      writeAll: vi.fn(),
      writeFocused: vi.fn(),
    });

    expect(vim.defineAction).toHaveBeenCalledWith(
      "diffViewerGoToDefinition",
      expect.any(Function),
    );
    expect(vim.mapCommand).toHaveBeenCalledWith(
      "gd",
      "action",
      "diffViewerGoToDefinition",
      {},
      { context: "normal" },
    );
  });

  it("registers :w and :wa write commands", () => {
    const vim = {
      defineAction: vi.fn(),
      defineEx: vi.fn(),
      mapCommand: vi.fn(),
    };

    registerVimPlugCommands(vim, {
      goToDefinition: vi.fn(),
      writeAll: vi.fn(),
      writeFocused: vi.fn(),
    });

    expect(vim.defineEx).toHaveBeenCalledWith("write", "w", expect.any(Function));
    expect(vim.defineEx).toHaveBeenCalledWith("wall", "wa", expect.any(Function));
  });

  it("routes command callbacks to the current editor", () => {
    const actions = new Map<string, (cm: { editor?: unknown }) => void>();
    const ex = new Map<string, (cm: { editor?: unknown }) => void>();
    const editor = {};
    const goToDefinition = vi.fn();
    const writeFocused = vi.fn();
    const writeAll = vi.fn();

    registerVimPlugCommands(
      {
        defineAction: (name, callback) => actions.set(name, callback),
        defineEx: (name, _prefix, callback) => ex.set(name, callback),
        mapCommand: vi.fn(),
      },
      { goToDefinition, writeAll, writeFocused },
    );

    actions.get("diffViewerGoToDefinition")?.({ editor });
    ex.get("write")?.({ editor });
    ex.get("wall")?.({});

    expect(goToDefinition).toHaveBeenCalledWith(editor);
    expect(writeFocused).toHaveBeenCalledWith(editor);
    expect(writeAll).toHaveBeenCalled();
  });
});
