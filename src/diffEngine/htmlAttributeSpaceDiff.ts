export type InlineRange = { start: number; end: number };

type AttributeRange = { start: number; end: number; name: string };

function findTagRanges(line: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let index = 0;
  while (index < line.length) {
    const lt = line.indexOf("<", index);
    if (lt === -1) {
      break;
    }
    let i = lt + 1;
    let quote: "\"" | "'" | null = null;
    for (; i < line.length; i += 1) {
      const ch = line[i];
      if (quote) {
        if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === "\"" || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === ">") {
        break;
      }
    }
    if (i >= line.length) {
      break;
    }
    ranges.push({ start: lt, end: i + 1 });
    index = i + 1;
  }
  return ranges;
}

const TARGET_ATTRIBUTES = new Set(["class", "id", "name", "value"]);

function isTargetAttribute(name: string): boolean {
  if (TARGET_ATTRIBUTES.has(name)) {
    return true;
  }
  return name.startsWith("data-") || name.startsWith("aria-");
}

function extractAttributeValueRanges(line: string): AttributeRange[] {
  const ranges: AttributeRange[] = [];
  const tagRanges = findTagRanges(line);

  for (const tag of tagRanges) {
    const content = line.slice(tag.start + 1, tag.end - 1);
    let i = 0;

    while (i < content.length) {
      while (i < content.length && /\s/.test(content[i])) {
        i += 1;
      }
      const nameStart = i;
      while (i < content.length && /[A-Za-z0-9_:\-]/.test(content[i])) {
        i += 1;
      }
      if (i === nameStart) {
        i += 1;
        continue;
      }
      const name = content.slice(nameStart, i).toLowerCase();
      while (i < content.length && /\s/.test(content[i])) {
        i += 1;
      }
      if (content[i] !== "=") {
        continue;
      }
      i += 1;
      while (i < content.length && /\s/.test(content[i])) {
        i += 1;
      }

      let quote: "\"" | "'" | null = null;
      let escapedQuote = false;
      if (content[i] === "\\" && (content[i + 1] === "\"" || content[i + 1] === "'")) {
        escapedQuote = true;
        quote = content[i + 1] as "\"" | "'";
        i += 2;
      } else if (content[i] === "\"" || content[i] === "'") {
        quote = content[i] as "\"" | "'";
        i += 1;
      }

      if (!quote) {
        continue;
      }

      const valueStart = i;
      let valueEnd = -1;
      while (i < content.length) {
        if (escapedQuote) {
          if (content[i] === "\\" && content[i + 1] === quote) {
            valueEnd = i;
            i += 2;
            break;
          }
        } else if (content[i] === quote) {
          valueEnd = i;
          i += 1;
          break;
        }
        i += 1;
      }

      if (valueEnd === -1) {
        break;
      }

      if (isTargetAttribute(name)) {
        const start = tag.start + 1 + valueStart;
        const end = tag.start + 1 + valueEnd;
        ranges.push({ start, end, name });
      }
    }
  }

  return ranges;
}

function isAsciiSpaceOnly(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  for (const ch of value) {
    if (ch !== " ") {
      return false;
    }
  }
  return true;
}

function findSpaceRangesInAttributes(
  line: string,
  diffRanges: InlineRange[],
): { spaces: InlineRange[]; hasTab: boolean } {
  if (diffRanges.length === 0 || line.length === 0) {
    return { spaces: [], hasTab: false };
  }
  const attrRanges = extractAttributeValueRanges(line);
  if (attrRanges.length === 0) {
    return { spaces: [], hasTab: false };
  }

  const spaces: InlineRange[] = [];
  let hasTab = false;
  for (const diffRange of diffRanges) {
    for (const attrRange of attrRanges) {
      const start = Math.max(diffRange.start, attrRange.start);
      const end = Math.min(diffRange.end, attrRange.end);
      if (start >= end) {
        continue;
      }
      const fragment = line.slice(start, end);
      if (fragment.includes("\t")) {
        hasTab = true;
      }
      if (isAsciiSpaceOnly(fragment)) {
        spaces.push({ start, end });
      }
    }
  }

  return { spaces, hasTab };
}

function hasTabInAttributeValues(line: string): boolean {
  if (line.includes("\t")) {
    return true;
  }
  const ranges = extractAttributeValueRanges(line);
  for (const range of ranges) {
    if (line.slice(range.start, range.end).includes("\t")) {
      return true;
    }
  }
  return false;
}

export function extractHtmlAttributeSpaceDiffRangesPair(
  leftLine: string,
  rightLine: string,
  leftRanges: InlineRange[],
  rightRanges: InlineRange[],
): { left: InlineRange[]; right: InlineRange[] } {
  if (hasTabInAttributeValues(leftLine) || hasTabInAttributeValues(rightLine)) {
    return { left: [], right: [] };
  }
  const leftResult = findSpaceRangesInAttributes(leftLine, leftRanges);
  const rightResult = findSpaceRangesInAttributes(rightLine, rightRanges);
  if (leftResult.hasTab || rightResult.hasTab) {
    return { left: [], right: [] };
  }
  return { left: leftResult.spaces, right: rightResult.spaces };
}
