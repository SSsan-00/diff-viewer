export type ArrayIfSignature = {
  dialect: "php" | "converted";
  key: string;
};

// Limit the exception to empty-string checks; general callee matching stays strict.
const PHP_ARRAY_IF =
  /^[ \t]*if[ \t]*\([ \t]*\$([A-Za-z_][A-Za-z0-9_]*)[ \t]*\[[ \t]*(['"])([A-Za-z0-9_]+)\2[ \t]*\][ \t]*!=[ \t]*""[ \t]*\)[ \t]*(?:\{[ \t]*)?$/;
const CONVERTED_ARRAY_IF =
  /^[ \t]*if[ \t]*\([ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*\[[ \t]*"([A-Za-z0-9_]+)"[ \t]*\][ \t]*\.[ \t]*s[ \t]*\([ \t]*\)[ \t]*!=[ \t]*""[ \t]*\)[ \t]*(?:\{[ \t]*)?$/;

export function extractArrayIfSignature(line: string): ArrayIfSignature | null {
  const php = line.match(PHP_ARRAY_IF);
  if (php) {
    return { dialect: "php", key: JSON.stringify([php[1], php[3]]) };
  }
  const converted = line.match(CONVERTED_ARRAY_IF);
  if (converted) {
    return { dialect: "converted", key: JSON.stringify([converted[1], converted[2]]) };
  }
  return null;
}
