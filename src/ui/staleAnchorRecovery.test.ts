import { describe, expect, it } from "vitest";
import type { StaleManualAnchor } from "../storage/workspaces";
import { recoverUnambiguousStaleAnchors } from "./staleAnchorRecovery";

type RecoverableStale = StaleManualAnchor & {
  tracking?: { leftLineNo: number | null; rightLineNo: number | null };
};

describe("recoverUnambiguousStaleAnchors", () => {
  it("reactivates a uniquely mapped candidate after its temporary conflict is gone", () => {
    const stale: RecoverableStale[] = [
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        tracking: { leftLineNo: 2, rightLineNo: 2 },
        reason: "reload-unresolved",
      },
    ];

    expect(
      recoverUnambiguousStaleAnchors([], stale, {
        leftLineCount: 5,
        rightLineCount: 5,
      }),
    ).toEqual({
      manualAnchors: [{ leftLineNo: 2, rightLineNo: 2 }],
      staleManualAnchors: [],
      recovered: 1,
    });
  });

  it("keeps mapper-unresolved stale anchors inactive", () => {
    const stale: RecoverableStale[] = [
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        reason: "reload-unresolved",
      },
    ];

    expect(
      recoverUnambiguousStaleAnchors([], stale, {
        leftLineCount: 5,
        rightLineCount: 5,
      }),
    ).toMatchObject({ manualAnchors: [], staleManualAnchors: stale, recovered: 0 });
  });

  it("does not choose between mutually conflicting recovery candidates", () => {
    const stale: RecoverableStale[] = [
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        tracking: { leftLineNo: 2, rightLineNo: 2 },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 3, rightLineNo: 3 },
        tracking: { leftLineNo: 2, rightLineNo: 4 },
        reason: "reload-unresolved",
      },
    ];

    expect(
      recoverUnambiguousStaleAnchors([], stale, {
        leftLineCount: 6,
        rightLineCount: 6,
      }),
    ).toMatchObject({ manualAnchors: [], staleManualAnchors: stale, recovered: 0 });
  });

  it("recovers an independent candidate while retaining a conflicting group", () => {
    const active = [{ leftLineNo: 4, rightLineNo: 4 }];
    const stale: RecoverableStale[] = [
      {
        anchor: { leftLineNo: 0, rightLineNo: 0 },
        tracking: { leftLineNo: 0, rightLineNo: 0 },
        reason: "edit-unresolved",
      },
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        tracking: { leftLineNo: 2, rightLineNo: 2 },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 3, rightLineNo: 3 },
        tracking: { leftLineNo: 2, rightLineNo: 3 },
        reason: "reload-unresolved",
      },
    ];

    expect(
      recoverUnambiguousStaleAnchors(active, stale, {
        leftLineCount: 6,
        rightLineCount: 6,
      }),
    ).toEqual({
      manualAnchors: [
        { leftLineNo: 0, rightLineNo: 0 },
        { leftLineNo: 4, rightLineNo: 4 },
      ],
      staleManualAnchors: stale.slice(1),
      recovered: 1,
    });
  });

  it("does not choose either side of an order inversion between candidates", () => {
    const stale: RecoverableStale[] = [
      {
        anchor: { leftLineNo: 0, rightLineNo: 2 },
        tracking: { leftLineNo: 0, rightLineNo: 2 },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 1, rightLineNo: 1 },
        tracking: { leftLineNo: 1, rightLineNo: 1 },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 3, rightLineNo: 3 },
        tracking: { leftLineNo: 3, rightLineNo: 3 },
        reason: "reload-unresolved",
      },
    ];

    expect(
      recoverUnambiguousStaleAnchors([], stale, {
        leftLineCount: 5,
        rightLineCount: 5,
      }),
    ).toEqual({
      manualAnchors: [{ leftLineNo: 3, rightLineNo: 3 }],
      staleManualAnchors: stale.slice(0, 2),
      recovered: 1,
    });
  });

  it("does not reactivate an out-of-range or order-reversing candidate", () => {
    const active = [{ leftLineNo: 2, rightLineNo: 2 }];
    const stale: RecoverableStale[] = [
      {
        anchor: { leftLineNo: 0, rightLineNo: 4 },
        tracking: { leftLineNo: 0, rightLineNo: 4 },
        reason: "reload-unresolved",
      },
      {
        anchor: { leftLineNo: 8, rightLineNo: 8 },
        tracking: { leftLineNo: 8, rightLineNo: 8 },
        reason: "reload-unresolved",
      },
    ];

    expect(
      recoverUnambiguousStaleAnchors(active, stale, {
        leftLineCount: 5,
        rightLineCount: 5,
      }),
    ).toMatchObject({ manualAnchors: active, staleManualAnchors: stale, recovered: 0 });
  });

  it("checks a large nonconflicting candidate batch with bounded coordinate reads", () => {
    const candidateCount = 300;
    let coordinateReads = 0;
    const stale: RecoverableStale[] = Array.from(
      { length: candidateCount },
      (_, lineNo) => {
        const tracking = {} as NonNullable<RecoverableStale["tracking"]>;
        Object.defineProperties(tracking, {
          leftLineNo: {
            enumerable: true,
            get: () => {
              coordinateReads += 1;
              return lineNo;
            },
          },
          rightLineNo: {
            enumerable: true,
            get: () => {
              coordinateReads += 1;
              return lineNo;
            },
          },
        });
        return {
          anchor: { leftLineNo: lineNo, rightLineNo: lineNo },
          tracking,
          reason: "reload-unresolved",
        };
      },
    );

    const result = recoverUnambiguousStaleAnchors([], stale, {
      leftLineCount: candidateCount + 1,
      rightLineCount: candidateCount + 1,
    });

    expect(result.recovered).toBe(candidateCount);
    expect(result.staleManualAnchors).toEqual([]);
    expect(coordinateReads).toBe(candidateCount * 2);
  });
});
