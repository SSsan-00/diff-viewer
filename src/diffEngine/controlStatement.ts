export type ControlStatementSignature = {
  dialect: "php" | "converted";
  key: string;
};

export function extractControlStatementSignature(line: string): ControlStatementSignature | null {
  let source = line.trim();
  let dialect: ControlStatementSignature["dialect"] | null = null;
  if (source.startsWith("<?")) {
    const wrapper = source.match(/^<\?(?:php\b)?\s*([\s\S]*?)\s*\?>$/);
    if (!wrapper) return null;
    source = wrapper[1];
    dialect = "php";
  } else if (source.startsWith("@")) {
    source = source.slice(1);
    dialect = "converted";
  }
  const header = source.match(/^(if|switch|for)\s*\((.*)$/);
  if (!header) return null;
  const kind = header[1];
  source = header[2];
  const tokens = source.match(/\s+|\$?[A-Za-z_][A-Za-z0-9_]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\+\+|--|[+-]?(?:\d+(?:\.\d+)?|\.\d+)|!=|==|<=|>=|&&|\|\||[()[\].+<>{}=;]/g);
  if (!tokens || tokens.length > 2048 || tokens.join("") !== source) return null;
  const input = tokens.filter((token) => !/^\s+$/.test(token));
  let index = 0;
  const take = (value: string): boolean => {
    if (input[index] !== value) return false;
    index += 1;
    return true;
  };
  function literal(): unknown {
    const value = input[index];
    if (!value) return null;
    if (/^['"]/.test(value)) {
      if (value.includes("\\")) return null;
      index += 1;
      return ["string", value.slice(1, -1)];
    }
    if (/^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)|true|false|null)$/.test(value)) {
      index += 1;
      return ["literal", value];
    }
    return null;
  }
  function identifier(): string | null {
    const name = input[index++];
    if (!name || !/^\$?[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
    const current = name.startsWith("$") ? "php" : "converted";
    if (dialect && dialect !== current) return null;
    dialect = current;
    return name.replace(/^\$/, "");
  }
  function reference(requireArray = false): unknown {
    const name = identifier();
    if (!name) return null;
    if (!take("[")) return requireArray ? null : ["variable", name];
    const key = input[index++];
    if (!key || !/^(['"])[A-Za-z0-9_]+\1$/.test(key)) return null;
    let keyExpression: unknown = ["string", key.slice(1, -1)];
    if (take(dialect === "php" ? "." : "+")) {
      const suffix = identifier();
      if (!suffix) return null;
      keyExpression = ["concat", keyExpression, ["variable", suffix]];
    }
    if (!take("]")) return null;
    return ["array", name, keyExpression];
  }
  function operand(): unknown {
    const value = literal();
    if (value) return value;
    const ref = reference();
    if (!ref) return null;
    if (Array.isArray(ref) && ref[0] === "array" && dialect === "converted") {
      if (!take(".") || !["s", "i", "m", "b"].includes(input[index++]) || !take("(") || !take(")")) return null;
    }
    return ref;
  }
  function atom(): unknown {
    if (take("(")) {
      const nested = expression();
      return nested && take(")") ? nested : null;
    }
    const left = operand();
    const operator = input[index++];
    if (!left || !["!=", "==", "<", ">", "<=", ">="].includes(operator)) return null;
    const right = operand();
    return right ? [left, operator, right] : null;
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
  let parsed: unknown;
  if (kind === "for") {
    const declared = take("int");
    const counter = identifier();
    if (!counter || (declared && dialect !== "converted") || !take("=")) return null;
    const start = literal();
    if (!start || !take(";")) return null;
    const condition = expression();
    if (!condition || !take(";")) return null;
    const updated = identifier();
    const update = input[index++];
    if (!updated || !["++", "--"].includes(update)) return null;
    parsed = [counter, start, condition, updated, update];
  } else parsed = kind === "switch" ? operand() : expression();
  if (!parsed || !dialect || !take(")")) return null;
  let assignment: unknown = null;
  if (index < input.length && !take("{")) {
    if (kind !== "if") return null;
    const target = reference(true);
    if (!target || !take("=")) return null;
    const value = literal();
    if (!value || !take(";")) return null;
    assignment = [target, "=", value];
  }
  if (index !== input.length) return null;
  return { dialect, key: JSON.stringify([kind, parsed, assignment]) };
}
