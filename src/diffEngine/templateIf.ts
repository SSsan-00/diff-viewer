export type TemplateIfSignature = {
  dialect: "php" | "razor";
  key: string;
};

type SimpleCondition = {
  identifier: string;
  literal: string;
  operator: string;
};

// Keep this grammar narrow so control statements, assignments, and calls cannot
// become replace candidates merely because they contain the same identifier.
const PHP_SIMPLE_CONDITION =
  /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|<=|>=|<|>)\s*("(?:\\.|[^"\\])*"|[+-]?(?:\d+(?:\.\d+)?|\.\d+)|true|false|null)\s*$/;
const RAZOR_SIMPLE_CONDITION =
  /^\s*Model\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|<=|>=|<|>)\s*("(?:\\.|[^"\\])*"|[+-]?(?:\d+(?:\.\d+)?|\.\d+)|true|false|null)\s*$/;

function parseSimpleCondition(
  condition: string,
  dialect: TemplateIfSignature["dialect"],
): SimpleCondition | null {
  const matched = condition.match(
    dialect === "php" ? PHP_SIMPLE_CONDITION : RAZOR_SIMPLE_CONDITION,
  );
  const identifier = matched?.[1];
  const operator = matched?.[2];
  const literal = matched?.[3];
  if (!identifier || !operator || literal === undefined) {
    return null;
  }
  return { identifier, literal, operator };
}

function buildSignature(
  dialect: TemplateIfSignature["dialect"],
  condition: string,
): TemplateIfSignature | null {
  const parsed = parseSimpleCondition(condition, dialect);
  if (!parsed) {
    return null;
  }
  return {
    dialect,
    key: JSON.stringify([parsed.identifier, parsed.operator, parsed.literal]),
  };
}

export function extractTemplateIfSignature(
  line: string,
): TemplateIfSignature | null {
  const php = line.match(
    /^\s*(?:<\?php\s+|<\?\s+)if\b\s*\((.*)\)\s*\{\s*\?>\s*$/i,
  );
  if (php) {
    return buildSignature("php", php[1] ?? "");
  }

  const razor = line.match(/^\s*@if\b\s*\((.*)\)\s*(?:\{\s*)?$/);
  if (razor) {
    return buildSignature("razor", razor[1] ?? "");
  }
  return null;
}

export function areEquivalentPhpRazorIfLines(
  left: string,
  right: string,
): boolean {
  return areEquivalentTemplateIfSignatures(
    extractTemplateIfSignature(left),
    extractTemplateIfSignature(right),
  );
}

export function areEquivalentTemplateIfSignatures(
  leftSignature: TemplateIfSignature | null,
  rightSignature: TemplateIfSignature | null,
): boolean {
  return Boolean(
    leftSignature &&
      rightSignature &&
      leftSignature.dialect !== rightSignature.dialect &&
      leftSignature.key === rightSignature.key,
  );
}
