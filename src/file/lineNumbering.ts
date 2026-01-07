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

function findSegment(segments: LineSegment[], lineNumber: number): LineSegment | null {
  for (const segment of segments) {
    const end = segment.startLine + segment.lineCount - 1;
    if (lineNumber >= segment.startLine && lineNumber <= end) {
      return segment;
    }
  }
  return null;
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
