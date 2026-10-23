import { describe, expect, it } from "vitest";
import type { Anchor } from "../diffEngine/anchors";
import {
  prepareContentChanges,
  transformAnchorsWithPreparedChanges,
  transformTrackedLineWithPreparedChanges,
  type ContentChangeLike,
  type ContentChangeTrackingContext,
} from "./anchorTracking";

function change(
  startLineNumber: number,
  startColumn: number,
  endLineNumber: number,
  endColumn: number,
  text: string,
): ContentChangeLike {
  return {
    range: {
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
    },
    text,
  };
}

function trackingContext(beforeText: string): ContentChangeTrackingContext {
  const lines = beforeText.split(/\r\n|\r|\n/);
  return {
    getBeforeLineContent: (lineNumber) => lines[lineNumber - 1],
  };
}

describe("transformTrackedLineWithPreparedChanges", () => {
  it("shifts a tracked line when whole lines are inserted before it", () => {
    expect(
      transformTrackedLineWithPreparedChanges(3, prepareContentChanges([change(2, 1, 2, 1, "first\nsecond\n")])),
    ).toEqual({ lineNo: 5, stale: false });
  });

  it("shifts a tracked line when a preceding whole line is deleted", () => {
    expect(transformTrackedLineWithPreparedChanges(3, prepareContentChanges([change(2, 1, 3, 1, "")]))).toEqual({
      lineNo: 2,
      stale: false,
    });
  });

  it("tracks through a whole-line deletion ending at the tracked line start", () => {
    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges([change(2, 1, 3, 1, "")]))).toEqual({
      lineNo: 1,
      stale: false,
    });
  });

  it("tracks through a whole-line replacement ending at the tracked line start", () => {
    expect(
      transformTrackedLineWithPreparedChanges(3, prepareContentChanges([change(2, 1, 4, 1, "replacement\n")])),
    ).toEqual({
      lineNo: 2,
      stale: false,
    });
  });

  it("counts a trailing CRLF once for a safe preceding replacement", () => {
    expect(
      transformTrackedLineWithPreparedChanges(3, prepareContentChanges([change(2, 1, 4, 1, "replacement\r\n")])),
    ).toEqual({
      lineNo: 2,
      stale: false,
    });
  });

  it("does not move for changes after the tracked line", () => {
    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges([change(5, 1, 5, 1, "later\n")]))).toEqual({
      lineNo: 2,
      stale: false,
    });
  });

  it("keeps an inline non-structural edit on the tracked line", () => {
    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges([change(3, 2, 3, 5, "value")]))).toEqual({
      lineNo: 2,
      stale: false,
    });
  });

  it("tracks the original content when lines are inserted at its line start", () => {
    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges([change(3, 1, 3, 1, "added\n")]))).toEqual({
      lineNo: 3,
      stale: false,
    });
  });

  it("keeps the tracked line when a newline is inserted exactly at its end", () => {
    expect(
      transformTrackedLineWithPreparedChanges(1, prepareContentChanges([change(2, 7, 2, 7, "\n")]), trackingContext("head\ntarget\ntail")),
    ).toEqual({ lineNo: 1, stale: false });
  });

  it("keeps an end-of-line newline insertion stale without pre-change line context", () => {
    expect(transformTrackedLineWithPreparedChanges(1, prepareContentChanges([change(2, 7, 2, 7, "\n")]))).toEqual({
      lineNo: 1,
      stale: true,
    });
  });

  it("moves the tracked line up when only the newline immediately before it is deleted", () => {
    expect(
      transformTrackedLineWithPreparedChanges(1, prepareContentChanges([change(1, 5, 2, 1, "")]), trackingContext("head\ntarget\ntail")),
    ).toEqual({ lineNo: 0, stale: false });
  });

  it("keeps the tracked line when only the newline immediately after it is deleted", () => {
    expect(
      transformTrackedLineWithPreparedChanges(1, prepareContentChanges([change(2, 7, 3, 1, "")]), trackingContext("head\ntarget\ntail")),
    ).toEqual({ lineNo: 1, stale: false });
  });

  it("follows one complete exact copy of the original line inside a multiline replacement", () => {
    expect(
      transformTrackedLineWithPreparedChanges(2, prepareContentChanges([change(2, 1, 5, 1, "target\nother\n")]), trackingContext("head\nbefore\ntarget\nafter\ntail")),
    ).toEqual({ lineNo: 1, stale: false });
  });

  it("combines a uniquely preserved line with independent changes in original coordinates", () => {
    const changes = [
      change(2, 1, 5, 1, "target\nother\n"),
      change(1, 1, 1, 1, "inserted\n"),
      change(8, 1, 8, 1, "later\n"),
    ];
    const context = trackingContext(
      "head\nbefore\ntarget\nafter\ntail\nmore\nlast\nend",
    );

    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges(changes), context)).toEqual({
      lineNo: 2,
      stale: false,
    });
    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges([...changes].reverse()), context)).toEqual({
      lineNo: 2,
      stale: false,
    });
  });

  it.each([
    {
      name: "the tracked line is split in its middle",
      contentChange: change(3, 4, 3, 4, "\n"),
    },
    {
      name: "the tracked line is fully deleted",
      contentChange: change(3, 1, 4, 1, ""),
    },
    {
      name: "the replacement contains multiple complete copies",
      contentChange: change(2, 1, 5, 1, "target\ntarget\n"),
      trackedLineNo: 2,
      beforeText: "head\nbefore\ntarget\nafter\ntail",
    },
    {
      name: "the replaced source range contains duplicate original lines",
      contentChange: change(2, 1, 5, 1, "target\nother\n"),
      trackedLineNo: 1,
      beforeText: "head\ntarget\ntarget\nafter\ntail",
    },
  ])(
    "keeps structural tracking stale when $name",
    ({
      contentChange,
      trackedLineNo = 2,
      beforeText = "head\nbefore\ntarget\nafter\ntail",
    }) => {
      expect(
        transformTrackedLineWithPreparedChanges(trackedLineNo, prepareContentChanges([contentChange]), trackingContext(beforeText)),
      ).toEqual({ lineNo: trackedLineNo, stale: true });
    },
  );

  it.each([
    {
      name: "a newline inserted inside the tracked line",
      contentChange: change(3, 3, 3, 3, "\n"),
    },
    {
      name: "the tracked line deleted as a whole",
      contentChange: change(3, 1, 4, 1, ""),
    },
    {
      name: "a deletion crossing into the tracked line",
      contentChange: change(2, 3, 3, 2, ""),
    },
    {
      name: "a deletion merging the tracked line into a preceding partial line",
      contentChange: change(2, 3, 3, 1, ""),
    },
    {
      name: "a preceding whole line replaced without a trailing newline",
      contentChange: change(2, 1, 3, 1, "prefix"),
    },
    {
      name: "a deletion merging the tracked line with the following line",
      contentChange: change(3, 4, 4, 1, ""),
    },
  ])("marks the result stale for $name", ({ contentChange }) => {
    expect(transformTrackedLineWithPreparedChanges(2, prepareContentChanges([contentChange]))).toEqual({
      lineNo: 2,
      stale: true,
    });
  });

  it("handles multiple original-coordinate changes independently of input order", () => {
    const changes = [
      change(2, 1, 2, 1, "first\nsecond\n"),
      change(10, 1, 10, 1, "later\n"),
      change(5, 1, 6, 1, ""),
    ];

    expect(transformTrackedLineWithPreparedChanges(7, prepareContentChanges(changes))).toEqual({ lineNo: 8, stale: false });
    expect(transformTrackedLineWithPreparedChanges(7, prepareContentChanges([...changes].reverse()))).toEqual({
      lineNo: 8,
      stale: false,
    });
    expect(changes.map((item) => item.range.startLineNumber)).toEqual([2, 10, 5]);
  });

  it("combines a safe preceding replacement with multiple original-coordinate changes", () => {
    const changes = [
      change(2, 1, 4, 1, "replacement\r\n"),
      change(1, 1, 1, 1, "inserted\n"),
      change(8, 1, 8, 1, "later\n"),
    ];

    expect(transformTrackedLineWithPreparedChanges(3, prepareContentChanges(changes))).toEqual({
      lineNo: 3,
      stale: false,
    });
    expect(transformTrackedLineWithPreparedChanges(3, prepareContentChanges([...changes].reverse()))).toEqual({
      lineNo: 3,
      stale: false,
    });
  });

  it("keeps a preceding replacement stale when its text has no trailing newline", () => {
    expect(
      transformTrackedLineWithPreparedChanges(3, prepareContentChanges([change(2, 1, 4, 1, "replacement")])),
    ).toEqual({
      lineNo: 3,
      stale: true,
    });
  });

  it("does not invent a shifted location when one of multiple changes makes it stale", () => {
    expect(
      transformTrackedLineWithPreparedChanges(4, prepareContentChanges([
        change(1, 1, 1, 1, "before\n"),
        change(5, 2, 5, 2, "\n"),
      ])),
    ).toEqual({ lineNo: 4, stale: true });
  });
});

describe("transformAnchorsWithPreparedChanges", () => {
  const anchors: readonly Anchor[] = [
    { leftLineNo: 1, rightLineNo: 3 },
    { leftLineNo: 4, rightLineNo: 6 },
  ];

  it("transforms only the requested side without mutating the anchors", () => {
    const result = transformAnchorsWithPreparedChanges(anchors, "left", prepareContentChanges([change(1, 1, 1, 1, "added\n")]));

    expect(result).toEqual([
      { anchor: { leftLineNo: 2, rightLineNo: 3 }, stale: false },
      { anchor: { leftLineNo: 5, rightLineNo: 6 }, stale: false },
    ]);
    expect(anchors).toEqual([
      { leftLineNo: 1, rightLineNo: 3 },
      { leftLineNo: 4, rightLineNo: 6 },
    ]);
  });

  it("can transform the right side while preserving left line numbers", () => {
    expect(
      transformAnchorsWithPreparedChanges(anchors, "right", prepareContentChanges([change(1, 1, 1, 1, "added\n")])),
    ).toEqual([
      { anchor: { leftLineNo: 1, rightLineNo: 4 }, stale: false },
      { anchor: { leftLineNo: 4, rightLineNo: 7 }, stale: false },
    ]);
  });

  it("marks only the anchor whose logical line became ambiguous", () => {
    expect(
      transformAnchorsWithPreparedChanges(anchors, "left", prepareContentChanges([change(2, 3, 2, 3, "\n")])),
    ).toEqual([
      { anchor: { leftLineNo: 1, rightLineNo: 3 }, stale: true },
      { anchor: { leftLineNo: 5, rightLineNo: 6 }, stale: false },
    ]);
  });

  it("orders original-coordinate changes only once for the whole anchor array", () => {
    const source = [
      change(10, 1, 10, 1, "later\n"),
      change(1, 1, 1, 1, "added\n"),
    ];
    let iterationCount = 0;
    const changes = new Proxy(source, {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          return () => {
            iterationCount += 1;
            return target[Symbol.iterator]();
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });

    expect(transformAnchorsWithPreparedChanges(anchors, "left", prepareContentChanges(changes))).toEqual([
      { anchor: { leftLineNo: 2, rightLineNo: 3 }, stale: false },
      { anchor: { leftLineNo: 5, rightLineNo: 6 }, stale: false },
    ]);
    expect(iterationCount).toBe(1);
  });

  it("reads each change text once for every anchor in the batch", () => {
    let textReads = 0;
    const contentChange: ContentChangeLike = {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
      get text() {
        textReads += 1;
        return "large pasted line\n";
      },
    };

    expect(
      transformAnchorsWithPreparedChanges(anchors, "left", prepareContentChanges([contentChange])),
    ).toEqual([
      { anchor: { leftLineNo: 2, rightLineNo: 3 }, stale: false },
      { anchor: { leftLineNo: 5, rightLineNo: 6 }, stale: false },
    ]);
    expect(textReads).toBe(1);
  });

  it("prepares structural source and replacement lines once for active and pending tracking", () => {
    const beforeLines = ["head", "first", "second", "tail"];
    let beforeLineReads = 0;
    const context: ContentChangeTrackingContext = {
      getBeforeLineContent: (lineNumber) => {
        beforeLineReads += 1;
        return beforeLines[lineNumber - 1];
      },
    };
    const prepared = prepareContentChanges([
      change(1, 1, 4, 5, "head\nfirst\nsecond\ntail"),
    ]);

    expect(
      transformAnchorsWithPreparedChanges(
        [
          { leftLineNo: 1, rightLineNo: 1 },
          { leftLineNo: 2, rightLineNo: 2 },
        ],
        "left",
        prepared,
        context,
      ),
    ).toEqual([
      { anchor: { leftLineNo: 1, rightLineNo: 1 }, stale: false },
      { anchor: { leftLineNo: 2, rightLineNo: 2 }, stale: false },
    ]);
    expect(
      transformTrackedLineWithPreparedChanges(3, prepared, context),
    ).toEqual({ lineNo: 3, stale: false });
    expect(beforeLineReads).toBe(beforeLines.length);
  });
});
