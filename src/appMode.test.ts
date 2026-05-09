import { describe, expect, it } from "vitest";
import { resolveAppMode } from "./appMode";

describe("resolveAppMode", () => {
  it("keeps writeback disabled by default", () => {
    expect(resolveAppMode({ search: "", hash: "" })).toEqual({
      diffCalculationMode: "normal",
      diffEngineMode: "auto",
      diffHighlightMode: "normal",
      manualMode: "app",
      vimMode: "off",
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

  it("uses normal diff calculation by default", () => {
    expect(resolveAppMode({ search: "" }).diffCalculationMode).toBe("normal");
  });

  it("enables anchor-only diff calculation from ?diff=off", () => {
    expect(resolveAppMode({ search: "?diff=off" }).diffCalculationMode).toBe(
      "anchor-only",
    );
  });

  it("keeps writeback enabled when ?save=on is combined with ?diff=off", () => {
    expect(resolveAppMode({ search: "?save=on&diff=off" })).toEqual({
      diffCalculationMode: "anchor-only",
      diffEngineMode: "auto",
      diffHighlightMode: "normal",
      manualMode: "app",
      vimMode: "off",
      writebackEnabled: true,
    });
  });

  it("uses normal diff highlighting by default", () => {
    expect(resolveAppMode({ search: "" }).diffHighlightMode).toBe("normal");
  });

  it("keeps only manual-anchor diff highlighting from ?highlight=off", () => {
    expect(resolveAppMode({ search: "?highlight=off" }).diffHighlightMode).toBe(
      "manual-anchor-only",
    );
  });

  it("combines highlight=off with save=on and diff=off", () => {
    expect(resolveAppMode({ search: "?save=on&diff=off&highlight=off" })).toEqual({
      diffCalculationMode: "anchor-only",
      diffEngineMode: "auto",
      diffHighlightMode: "manual-anchor-only",
      manualMode: "app",
      vimMode: "off",
      writebackEnabled: true,
    });
  });

  it("opens the manual screen from ?manual=on", () => {
    expect(resolveAppMode({ search: "?manual=on" }).manualMode).toBe("manual");
  });

  it("can read manual mode from hash parameters for standalone html use", () => {
    expect(resolveAppMode({ hash: "#manual=on" }).manualMode).toBe("manual");
  });

  it("keeps manual mode when combined with other startup parameters", () => {
    expect(
      resolveAppMode({
        search: "?manual=on&save=on&diff=off&highlight=off",
      }),
    ).toEqual({
      diffCalculationMode: "anchor-only",
      diffEngineMode: "auto",
      diffHighlightMode: "manual-anchor-only",
      manualMode: "manual",
      vimMode: "off",
      writebackEnabled: true,
    });
  });

  it("keeps hidden Vim plug mode disabled by default", () => {
    expect(resolveAppMode({ search: "" }).vimMode).toBe("off");
  });

  it("enables hidden Vim plug mode from entry=plug", () => {
    expect(resolveAppMode({ search: "?entry=plug" }).vimMode).toBe("plug");
  });

  it("keeps normal diff calculation and highlighting when only Vim plug mode is enabled", () => {
    expect(resolveAppMode({ search: "?entry=plug" })).toEqual({
      diffCalculationMode: "normal",
      diffEngineMode: "auto",
      diffHighlightMode: "normal",
      manualMode: "app",
      vimMode: "plug",
      writebackEnabled: false,
    });
  });

  it("can read hidden Vim plug mode from hash parameters", () => {
    expect(resolveAppMode({ hash: "#entry=plug" }).vimMode).toBe("plug");
  });

  it("keeps hidden Vim plug mode when combined with startup parameters", () => {
    expect(
      resolveAppMode({
        search: "?entry=plug&save=on&diff=off&highlight=off&manual=on",
      }),
    ).toEqual({
      diffCalculationMode: "anchor-only",
      diffEngineMode: "auto",
      diffHighlightMode: "manual-anchor-only",
      manualMode: "manual",
      vimMode: "plug",
      writebackEnabled: true,
    });
  });
});
