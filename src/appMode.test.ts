import { describe, expect, it } from "vitest";
import { resolveAppMode } from "./appMode";

describe("resolveAppMode", () => {
  it("keeps writeback disabled by default", () => {
    expect(resolveAppMode({ search: "", hash: "" })).toEqual({
      diffEngineMode: "auto",
      writebackEnabled: false,
    });
  });

  it("enables writeback only from ?save=on", () => {
    expect(resolveAppMode({ search: "?save=on" }).writebackEnabled).toBe(true);
  });

  it("ignores legacy or explicit disable parameters", () => {
    expect(resolveAppMode({ search: "?save=off" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ search: "?writeback=false" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ search: "?mode=no-save" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ hash: "#save=off" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ search: "?writeback=on" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ search: "?mode=save" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ hash: "#save=on" }).writebackEnabled).toBe(false);
  });

  it("uses auto diff engine mode by default", () => {
    expect(resolveAppMode({ search: "" }).diffEngineMode).toBe("auto");
  });

  it("reads diff engine mode from query parameters", () => {
    expect(resolveAppMode({ search: "?engine=ts" }).diffEngineMode).toBe("ts");
    expect(resolveAppMode({ search: "?engine=wasm" }).diffEngineMode).toBe("wasm");
    expect(resolveAppMode({ search: "?engine=auto" }).diffEngineMode).toBe("auto");
  });

  it("can read diff engine mode from hash parameters for standalone html use", () => {
    expect(resolveAppMode({ hash: "#engine=wasm" }).diffEngineMode).toBe("wasm");
  });

  it("prefers query diff engine mode over hash parameters", () => {
    expect(
      resolveAppMode({ search: "?engine=ts", hash: "#engine=wasm" }).diffEngineMode,
    ).toBe("ts");
  });

  it("ignores unknown diff engine modes", () => {
    expect(resolveAppMode({ search: "?engine=unknown" }).diffEngineMode).toBe("auto");
  });
});
