import { describe, expect, it } from "vitest";
import {
  createAppUrl,
  createManualUrl,
  resolveManualPresentationMode,
} from "./navigation";

describe("manual navigation", () => {
  it("adds manual=on while preserving existing query parameters", () => {
    expect(createManualUrl("file:///tmp/index.html?save=on#top")).toBe(
      "file:///tmp/index.html?save=on&manual=on#top",
    );
  });

  it("removes manual=on from search parameters when returning to the app", () => {
    expect(createAppUrl("file:///tmp/index.html?save=on&manual=on#top")).toBe(
      "file:///tmp/index.html?save=on#top",
    );
  });

  it("removes manual=on from hash parameters used by standalone html", () => {
    expect(createAppUrl("file:///tmp/index.html#manual=on&save=on")).toBe(
      "file:///tmp/index.html#save=on",
    );
  });

  it("uses route navigation when there are no file handles to preserve", () => {
    expect(
      resolveManualPresentationMode({
        hasPaneSaveTargets: false,
        paneSaveTargetStoreAvailable: false,
        fileSystemAccessSupported: false,
      }),
    ).toBe("route");
  });

  it("uses route navigation when file handles can be restored", () => {
    expect(
      resolveManualPresentationMode({
        hasPaneSaveTargets: true,
        paneSaveTargetStoreAvailable: true,
        fileSystemAccessSupported: true,
      }),
    ).toBe("route");
  });

  it("keeps the manual as an overlay when file handles cannot be restored", () => {
    expect(
      resolveManualPresentationMode({
        hasPaneSaveTargets: true,
        paneSaveTargetStoreAvailable: false,
        fileSystemAccessSupported: true,
      }),
    ).toBe("overlay");
    expect(
      resolveManualPresentationMode({
        hasPaneSaveTargets: true,
        paneSaveTargetStoreAvailable: true,
        fileSystemAccessSupported: false,
      }),
    ).toBe("overlay");
  });
});
