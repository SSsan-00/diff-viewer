/**
 * Leading-whitespace ignoring is a per-line rule. A leading empty line must not
 * disable indentation handling for every following line in the editor model.
 */
export function canIgnoreLeadingWhitespaceInEditorText(_text: string): boolean {
  return true;
}
