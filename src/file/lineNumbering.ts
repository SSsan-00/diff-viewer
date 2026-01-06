export type LineSegment = {
  startLine: number;
  lineCount: number;
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

export function createLineNumberFormatter(segments: LineSegment[]): (line: number) => string {
  return (lineNumber: number) => {
    const segment = findSegment(segments, lineNumber);
    if (!segment) {
      return String(lineNumber);
    }
    return String(lineNumber - segment.startLine + 1);
  };
}
