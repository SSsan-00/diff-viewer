import { describe, expect, it, vi } from "vitest";
import {
  getDevServerSpawnOptions,
  signalDevServerProcessTree,
} from "./perf-process.mjs";

describe("performance dev server process lifecycle", () => {
  it("starts a dedicated process group on POSIX", () => {
    expect(getDevServerSpawnOptions("darwin")).toMatchObject({
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  });

  it("signals the whole POSIX process group", () => {
    const killGroup = vi.fn();
    const killProcess = vi.fn();

    signalDevServerProcessTree(
      { pid: 1234, kill: killProcess },
      "SIGTERM",
      { platform: "darwin", killGroup },
    );

    expect(killGroup).toHaveBeenCalledWith(-1234, "SIGTERM");
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("falls back to signaling the direct process on Windows", () => {
    const killGroup = vi.fn();
    const killProcess = vi.fn();

    signalDevServerProcessTree(
      { pid: 1234, kill: killProcess },
      "SIGKILL",
      { platform: "win32", killGroup },
    );

    expect(killProcess).toHaveBeenCalledWith("SIGKILL");
    expect(killGroup).not.toHaveBeenCalled();
  });
});
