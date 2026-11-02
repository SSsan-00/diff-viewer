export type ArrayIfSignature = {
  dialect: "php" | "converted";
  key: string;
};

export function extractArrayIfSignature(line: string): ArrayIfSignature | null {
  const match = line.match(/^[ \t]*if[ \t]*\((.*)$/);
  if (!match) return null;
  const source = match[1];
  const tokens = source.match(/\s+|\$?[A-Za-z_][A-Za-z0-9_]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[+-]?(?:\d+(?:\.\d+)?|\.\d+)|!=|==|<=|>=|&&|\|\||[()[\].<>{}=;]/g);
  if (!tokens || tokens.length > 2048 || tokens.join("") !== source) return null;
  const input = tokens.filter((token) => !/^\s+$/.test(token));
  let index = 0;
  let dialect: ArrayIfSignature["dialect"] | null = null;
  const take = (value: string): boolean => {
    if (input[index] !== value) return false;
    index += 1;
    return true;
  };
  const literal = (): string | null => {
    const value = input[index];
    if (!value) return null;
    if (/^['"]/.test(value)) {
      // Escaped literals need language-specific decoding; leave them to normal matching.
      if (value.includes("\\")) return null;
      index += 1;
      return JSON.stringify(["string", value.slice(1, -1)]);
    }
    if (/^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)|true|false|null)$/.test(value)) {
      index += 1;
      return JSON.stringify(["literal", value]);
    }
    return null;
  };
  function arrayReference(): [string, string] | null {
    const name = input[index++];
    if (!name || !/^\$?[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !take("[")) return null;
    const key = input[index++];
    if (!key || !/^(['"])[A-Za-z0-9_]+\1$/.test(key) || !take("]")) return null;
    const current = name.startsWith("$") ? "php" : "converted";
    if (dialect && dialect !== current) return null;
    dialect = current;
    return [name.replace(/^\$/, ""), key.slice(1, -1)];
  }
  function atom(): unknown {
    if (take("(")) {
      const nested = expression();
      return nested && take(")") ? nested : null;
    }
    const reference = arrayReference();
    if (!reference) return null;
    if (dialect === "converted") {
      if (!take(".") || !["s", "i", "m", "b"].includes(input[index++]) || !take("(") || !take(")")) return null;
    }
    const operator = input[index++];
    if (!["!=", "==", "<", ">", "<=", ">="].includes(operator)) return null;
    const value = literal();
    return value === null ? null : [...reference, operator, value];
  }
  function conjunction(): unknown {
    let result = atom();
    while (result && take("&&")) {
      const right = atom();
      if (!right) return null;
      result = ["&&", result, right];
    }
    return result;
  }
  function expression(): unknown {
    let result = conjunction();
    while (result && take("||")) {
      const right = conjunction();
      if (!right) return null;
      result = ["||", result, right];
    }
    return result;
  }
  const parsed = expression();
  if (!parsed || !dialect || !take(")")) return null;
  let assignment: unknown = null;
  if (index < input.length && !take("{")) {
    const target = arrayReference();
    if (!target || !take("=")) return null;
    const value = literal();
    if (value === null || !take(";")) return null;
    assignment = [target, "=", value];
  }
  if (index !== input.length) return null;
  return { dialect, key: JSON.stringify(assignment ? [parsed, assignment] : parsed) };
}
