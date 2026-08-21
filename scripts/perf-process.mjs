export function getDevServerSpawnOptions(platform = process.platform) {
  return {
    detached: platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  };
}

export function signalDevServerProcessTree(proc, signal, options = {}) {
  const platform = options.platform ?? process.platform;
  const killGroup = options.killGroup ?? process.kill;

  if (platform !== "win32" && Number.isInteger(proc.pid)) {
    try {
      killGroup(-proc.pid, signal);
      return;
    } catch {
      // The group can already be gone while the parent handle is still open.
    }
  }

  proc.kill(signal);
}
