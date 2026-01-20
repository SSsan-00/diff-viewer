import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { copyFavoritePath } from "./favoriteCopy";

describe("copyFavoritePath", () => {
  it("closes on copy success", async () => {
    const doc = new JSDOM("<!doctype html><html><body></body></html>").window
      .document;
    const toast = { show: vi.fn() };
    const onSuccess = vi.fn();
    const copy = vi.fn(async () => true);

    const ok = await copyFavoritePath({
      path: "path",
      doc,
      copy,
      toast,
      onSuccess,
    });

    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast.show).toHaveBeenCalledWith("パスをコピーしました");
  });

  it("does not close on copy failure", async () => {
    const doc = new JSDOM("<!doctype html><html><body></body></html>").window
      .document;
    const toast = { show: vi.fn() };
    const onSuccess = vi.fn();
    const copy = vi.fn(async () => false);

    const ok = await copyFavoritePath({
      path: "path",
      doc,
      copy,
      toast,
      onSuccess,
    });

    expect(ok).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith("コピーに失敗しました", "error");
  });
});
