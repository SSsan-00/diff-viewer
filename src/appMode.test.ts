import { describe, expect, it } from "vitest";
import { resolveAppMode } from "./appMode";

describe("resolveAppMode", () => {
  it("keeps writeback disabled by default", () => {
    expect(resolveAppMode({ search: "", hash: "" })).toEqual({
      writebackEnabled: false,
    });
  });

  it("enables writeback from query parameters", () => {
    expect(resolveAppMode({ search: "?save=on" }).writebackEnabled).toBe(true);
    expect(resolveAppMode({ search: "?writeback=true" }).writebackEnabled).toBe(true);
    expect(resolveAppMode({ search: "?mode=save" }).writebackEnabled).toBe(true);
  });

  it("disables writeback from query parameters", () => {
    expect(resolveAppMode({ search: "?save=off" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ search: "?writeback=false" }).writebackEnabled).toBe(false);
    expect(resolveAppMode({ search: "?mode=no-save" }).writebackEnabled).toBe(false);
  });

  it("can disable writeback from hash parameters for standalone html use", () => {
    expect(resolveAppMode({ hash: "#save=off" }).writebackEnabled).toBe(false);
  });

  it("prefers query parameters over hash parameters", () => {
    expect(resolveAppMode({ search: "?save=on", hash: "#save=off" })).toEqual({
      writebackEnabled: true,
    });
  });
});
