import type { Range } from "./types";

export type ControlStatementSignature = {
  dialect: "php" | "converted";
  key: string;
  referenceRanges: Range[];
};

export function extractControlStatementSignature(line: string): ControlStatementSignature | null {
  let source = line.trim();
  let sourceOffset = line.length - line.trimStart().length;
  let dialect: ControlStatementSignature["dialect"] | null = null;
  if (source.startsWith("<?")) {
    const wrapper = source.match(/^<\?(?:php\b)?\s*([\s\S]*?)\s*\?>$/);
    if (!wrapper) return null;
    sourceOffset += source.indexOf(wrapper[1], source.startsWith("<?php") ? 5 : 2);
    source = wrapper[1];
    dialect = "php";
  } else if (source.startsWith("@")) {
    source = source.slice(1);
    sourceOffset += 1;
    dialect = "converted";
  }
  const header = source.match(/^(if|switch|for)\s*\((.*)$/);
  if (!header && !/^(?:\$|MathUtil\b)/.test(source)) return null;
  const kind = header?.[1] ?? "multiply";
  if (header) {
    sourceOffset += source.length - header[2].length;
    source = header[2];
  }
  const tokens = source.match(/\s+|\/\/[^\r\n]*|\/\*.*?\*\/|\$?[A-Za-z_][A-Za-z0-9_]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\+\+|--|[+-]?(?:\d+(?:\.\d+)?|\.\d+)|!=|==|<=|>=|&&|\|\||\*=|[()[\].+<>{}=;?:,]/g);
  if (!tokens || tokens.length > 2048 || tokens.join("") !== source) return null;
  while (tokens.length > 0 && /^(?:\s+$|\/\/|\/\*)/.test(tokens[tokens.length - 1])) tokens.pop();
  const input: string[] = [];
  const positions: number[] = [];
  for (const token of tokens) {
    if (!/^\s+$/.test(token)) {
      input.push(token);
      positions.push(sourceOffset);
    }
    sourceOffset += token.length;
  }
  const referenceRanges: Range[] = [];
  function addReferenceRange(tokenIndex: number, quoted = false): void {
    const token = input[tokenIndex];
    referenceRanges.push({
      start: positions[tokenIndex] + (quoted || token.startsWith("$") ? 1 : 0),
      end: positions[tokenIndex] + token.length - (quoted ? 1 : 0),
    });
  }
  let index = 0;
  const take = (value: string): boolean => {
    if (input[index] !== value) return false;
    index += 1;
    return true;
  };
  function acceptDialect(current: ControlStatementSignature["dialect"]): boolean {
    if (dialect && dialect !== current) return false;
    dialect = current;
    return true;
  }
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
    if (!acceptDialect(current)) return null;
    return name.replace(/^\$/, "");
  }
  function reference(requireArray = false, convertedOperand = false): unknown {
    let nameIndex = index;
    let name = input[index++];
    const model = name === "Model" && take(".");
    if (model) {
      nameIndex = index;
      name = input[index++];
    }
    if (!name || !/^\$?[A-Za-z_][A-Za-z0-9_]*$/.test(name) || (model && name.startsWith("$"))) return null;
    let current: ControlStatementSignature["dialect"] = model || !name.startsWith("$") ? "converted" : "php";
    name = name.replace(/^\$/, "");
    if (!take("[")) return !requireArray && !model && acceptDialect(current) ? ["variable", name] : null;
    const keyIndex = index;
    const key = input[index++];
    if (!key || !/^(['"])[A-Za-z0-9_]+\1$/.test(key)) return null;
    let keyExpression: unknown = ["string", key.slice(1, -1)];
    if (take(current === "php" ? "." : "+")) {
      const suffix = identifier();
      if (!suffix) return null;
      keyExpression = ["concat", keyExpression, ["variable", suffix]];
    }
    if (!take("]")) return null;
    if (convertedOperand) {
      if (take(".")) {
        if (!["s", "i", "m", "b"].includes(input[index++]) || !take("(") || !take(")")) return null;
        current = "converted";
      } else if (current === "converted") return null;
    }
    if (!acceptDialect(current)) return null;
    addReferenceRange(nameIndex);
    addReferenceRange(keyIndex, true);
    return ["array", name, keyExpression];
  }
  function operand(): unknown {
    if (take("(")) {
      if (take("isset")) {
        if (!take("(")) return null;
        const checkedRangeStart = referenceRanges.length;
        const checked = reference(true);
        if (!checked || dialect !== "php" || !take(")") || !take("?")) return null;
        // The value branch, rather than the repeated isset argument, anchors the converted reference.
        referenceRanges.length = checkedRangeStart;
        const value = reference(true);
        if (!value || JSON.stringify(checked) !== JSON.stringify(value) || !take(":")) return null;
        const fallback = literal();
        return Array.isArray(fallback) && fallback[0] === "string" && fallback[1] === "" && take(")") ? value : null;
      }
      const nested = operand();
      return nested && take(")") ? nested : null;
    }
    const value = literal();
    if (value) return value;
    return reference(false, true);
  }
  function atom(): unknown {
    const start = index;
    const previousDialect = dialect;
    const rangeStart = referenceRanges.length;
    const left = operand();
    const operator = input[index++];
    if (left && ["!=", "==", "<", ">", "<=", ">="].includes(operator)) {
      const right = operand();
      if (right) return [left, operator, right];
    }
    index = start;
    dialect = previousDialect;
    referenceRanges.length = rangeStart;
    if (take("(")) {
      const nested = expression();
      return nested && take(")") ? nested : null;
    }
    return null;
  }
  if (kind === "multiply") {
    let target: unknown;
    if (take("MathUtil")) {
      if (!take(".") || !take("Multiply") || !take("(") || !take("ref")) return null;
      const nameIndex = index;
      const name = identifier();
      if (!name || dialect !== "converted" || !take(".") || !take("Ref") || !take("(")) return null;
      const keyIndex = index;
      const key = input[index++];
      if (!key || !/^(['"])[A-Za-z0-9_]+\1$/.test(key) || !take(")") || !take(",")) return null;
      addReferenceRange(nameIndex);
      addReferenceRange(keyIndex, true);
      target = ["array", name, ["string", key.slice(1, -1)]];
    } else {
      target = reference(true);
      if (!target || dialect !== "php" || !take("*=")) return null;
    }
    const factor = literal();
    if (!Array.isArray(factor) || factor[0] !== "literal" || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(factor[1])) return null;
    if ((dialect === "converted" && !take(")")) || !take(";") || index !== input.length) return null;
    return { dialect, key: JSON.stringify([kind, target, factor]), referenceRanges };
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
  return { dialect, key: JSON.stringify([kind, parsed, assignment]), referenceRanges };
}

export function getControlStatementDiffParts(left: string, right: string): Array<{ left: Range; right: Range }> | null {
  const a = extractControlStatementSignature(left);
  const b = extractControlStatementSignature(right);
  if (!a || !b || a.dialect === b.dialect || a.key !== b.key ||
    a.referenceRanges.length === 0 || a.referenceRanges.length !== b.referenceRanges.length) return null;
  const parts: Array<{ left: Range; right: Range }> = [];
  let leftStart = 0;
  let rightStart = 0;
  for (let i = 0; i < a.referenceRanges.length; i++) {
    const l = a.referenceRanges[i];
    const r = b.referenceRanges[i];
    if (left.slice(l.start, l.end) !== right.slice(r.start, r.end)) return null;
    parts.push({ left: { start: leftStart, end: l.start }, right: { start: rightStart, end: r.start } });
    leftStart = l.end;
    rightStart = r.end;
  }
  parts.push({ left: { start: leftStart, end: left.length }, right: { start: rightStart, end: right.length } });
  return parts;
}
