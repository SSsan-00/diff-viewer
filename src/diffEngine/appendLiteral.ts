export type AppendLiteralMap = {
  payload: string;
  indices: number[];
};

export function extractAppendLiteral(line: string): string | null {
  return extractAppendLiteralWithMap(line)?.payload ?? null;
}

export function extractAppendLiteralWithMap(line: string): AppendLiteralMap | null {
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
  let result = "";
  const indices: number[] = [];
  const pushWithIndex = (value: string, index: number) => {
    if (value.length === 0) {
      return;
    }
    result += value;
    for (let j = 0; j < value.length; j += 1) {
      indices.push(index);
    }
  };
  let i = quoteIndex + 1;
  while (i < line.length) {
    const ch = line[i];
    if (!isVerbatim && ch === "\\" && i + 1 < line.length) {
      const next = line[i + 1];
      if (next === "t") {
        pushWithIndex("\t", i);
      } else if (next === "n") {
        pushWithIndex("\n", i);
      } else if (next === "r") {
        pushWithIndex("\r", i);
      } else {
        pushWithIndex(next, i);
      }
      i += 2;
      continue;
    }
    if (isVerbatim && ch === "\"" && line[i + 1] === "\"") {
      pushWithIndex("\"", i);
      i += 2;
      continue;
    }
    if (ch === "\"") {
      break;
    }
    if (isInterpolated && ch === "{") {
      if (line[i + 1] === "{") {
        pushWithIndex("{", i);
        i += 2;
        continue;
      }
      pushWithIndex("{expr}", i);
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
      pushWithIndex("}", i);
      i += 2;
      continue;
    }
    pushWithIndex(ch, i);
    i += 1;
  }
  if (result.trim().length === 0) {
    return null;
  }
  return { payload: result, indices };
}

export function toAppendLiteralOrLine(line: string): string {
  return extractAppendLiteral(line) ?? line;
}
