import type { Range } from "./types";

export type AppendLiteralMap = {
  payload: string;
  indices: number[];
};

export type AppendLiteralInlineMap = {
  payload: string;
  indices: number[];
  wrapperRanges: Range[];
  payloadRange: Range;
};

type AppendLiteralParseResult = {
  payload: string;
  indices: number[];
  startQuote: number;
  endQuote: number;
};

type AppendLiteralParseOptions = {
  preserveEscapes: boolean;
};

export function extractAppendLiteral(line: string): string | null {
  return extractAppendLiteralWithMap(line)?.payload ?? null;
}

function parseAppendLiteral(
  line: string,
  options: AppendLiteralParseOptions,
): AppendLiteralParseResult | null {
  const callMatch = line.match(/\.(?:append|appendline|appendformat)\s*\(/i);
  if (!callMatch || callMatch.index === undefined) {
    return null;
  }
  const startFrom = callMatch.index + callMatch[0].length;
  const quoteIndex = line.indexOf("\"", startFrom);
  if (quoteIndex === -1) {
    return null;
  }
  const prefix = line.slice(startFrom, quoteIndex);
  const isInterpolated = prefix.includes("$");
  const isVerbatim = prefix.includes("@");
  const result: string[] = [];
  const indices: number[] = [];
  const pushChar = (value: string, index: number) => {
    if (value.length === 0) {
      return;
    }
    result.push(value);
    indices.push(index);
  };
  const pushRepeated = (value: string, index: number) => {
    if (value.length === 0) {
      return;
    }
    for (let j = 0; j < value.length; j += 1) {
      result.push(value[j]);
      indices.push(index);
    }
  };
  let i = quoteIndex + 1;
  let endQuote = -1;
  while (i < line.length) {
    const ch = line[i];
    if (!isVerbatim && ch === "\\" && i + 1 < line.length) {
      const next = line[i + 1];
      if (options.preserveEscapes) {
        pushChar("\\", i);
        pushChar(next, i + 1);
      } else if (next === "t") {
        pushChar("\t", i);
      } else if (next === "n") {
        pushChar("\n", i);
      } else if (next === "r") {
        pushChar("\r", i);
      } else {
        pushChar(next, i);
      }
      i += 2;
      continue;
    }
    if (isVerbatim && ch === "\"" && line[i + 1] === "\"") {
      pushChar("\"", i);
      i += 2;
      continue;
    }
    if (ch === "\"") {
      endQuote = i;
      break;
    }
    if (isInterpolated && ch === "{") {
      if (line[i + 1] === "{") {
        pushChar("{", i);
        i += 2;
        continue;
      }
      pushRepeated("{expr}", i);
      i += 1;
      let depth = 1;
      while (i < line.length && depth > 0) {
        const c = line[i];
        if (c === "{" && line[i + 1] !== "{") {
          depth += 1;
        } else if (c === "}" && line[i + 1] !== "}") {
          depth -= 1;
        }
        if (c === "\"" && !isVerbatim) {
          i += 1;
          while (i < line.length) {
            if (line[i] === "\\" && i + 1 < line.length) {
              i += 2;
              continue;
            }
            if (line[i] === "\"") {
              i += 1;
              break;
            }
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      continue;
    }
    if (isInterpolated && ch === "}" && line[i + 1] === "}") {
      pushChar("}", i);
      i += 2;
      continue;
    }
    pushChar(ch, i);
    i += 1;
  }
  if (endQuote === -1) {
    return null;
  }
  return { payload: result.join(""), indices, startQuote: quoteIndex, endQuote };
}

export function extractAppendLiteralWithMap(line: string): AppendLiteralMap | null {
  const parsed = parseAppendLiteral(line, { preserveEscapes: false });
  if (!parsed || parsed.payload.trim().length === 0) {
    return null;
  }
  return { payload: parsed.payload, indices: parsed.indices };
}

export function extractAppendLiteralInlineMap(line: string): AppendLiteralInlineMap | null {
  const parsed = parseAppendLiteral(line, { preserveEscapes: true });
  if (!parsed || parsed.payload.trim().length === 0) {
    return null;
  }
  const payloadStart = parsed.startQuote + 1;
  const payloadEnd = parsed.endQuote;
  const wrapperRanges: Range[] = [];
  if (payloadStart > 0) {
    wrapperRanges.push({ start: 0, end: payloadStart });
  }
  if (parsed.endQuote < line.length) {
    wrapperRanges.push({ start: parsed.endQuote, end: line.length });
  }
  return {
    payload: parsed.payload,
    indices: parsed.indices,
    wrapperRanges,
    payloadRange: { start: payloadStart, end: payloadEnd },
  };
}

export function toAppendLiteralOrLine(line: string): string {
  return extractAppendLiteral(line) ?? line;
}
