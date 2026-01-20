export type LineSegment = {
  startLine: number;
  lineCount: number;
  fileIndex: number;
  fileName?: string;
  endsWithNewline?: boolean;
};

export type LineSegmentInfo = {
  fileIndex: number;
  fileName?: string;
  localLine: number;
};

export type LineChange = {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  text: string;
};

function findSegment(segments: LineSegment[], lineNumber: number): LineSegment | null {
  for (const segment of segments) {
    const end = segment.startLine + segment.lineCount - 1;
    if (lineNumber >= segment.startLine && lineNumber <= end) {
      return segment;
    }
  }
  return null;
}

export function getLineSegment(
  segments: LineSegment[],
  lineNumber: number,
): LineSegment | null {
  return findSegment(segments, lineNumber);
}

function findSegmentIndex(segments: LineSegment[], lineNumber: number): number {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const end = segment.startLine + segment.lineCount - 1;
    if (lineNumber >= segment.startLine && lineNumber <= end) {
      return index;
    }
  }
  return -1;
}

function getLineDelta(change: LineChange): number {
  const textLineCount = change.text.split("\n").length;
  const isInsert =
    change.range.startLineNumber === change.range.endLineNumber &&
    change.range.startColumn === change.range.endColumn;
  if (isInsert) {
    return textLineCount - 1;
  }
  const removedLines = change.range.endLineNumber - change.range.startLineNumber + 1;
  return textLineCount - removedLines;
}

export function updateSegmentsForChanges(
  segments: LineSegment[],
  changes: readonly LineChange[],
): void {
  if (segments.length === 0 || changes.length === 0) {
    return;
  }
  const sorted = [...changes].sort(
    (a, b) => b.range.startLineNumber - a.range.startLineNumber,
  );
  for (const change of sorted) {
    const delta = getLineDelta(change);
    if (delta === 0) {
      continue;
    }
    const index = findSegmentIndex(segments, change.range.startLineNumber);
    if (index < 0) {
      continue;
    }
    const nextCount = Math.max(1, segments[index].lineCount + delta);
    segments[index].lineCount = nextCount;
    for (let i = index + 1; i < segments.length; i += 1) {
      segments[i].startLine = segments[i - 1].startLine + segments[i - 1].lineCount;
    }
  }
}

export function getLineSegmentInfo(
  segments: LineSegment[],
  lineNumber: number,
): LineSegmentInfo | null {
  const segment = findSegment(segments, lineNumber);
  if (!segment) {
    return null;
  }
  return {
    fileIndex: segment.fileIndex,
    fileName: segment.fileName,
    localLine: lineNumber - segment.startLine + 1,
  };
}

export function createLineNumberFormatter(segments: LineSegment[]): (line: number) => string {
  return (lineNumber: number) => {
    const info = getLineSegmentInfo(segments, lineNumber);
    if (!info) {
      return String(lineNumber);
    }
    return String(info.localLine);
  };
}
