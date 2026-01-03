/**
 * Normalize line endings so diff logic can treat newlines consistently.
 * Do not add or remove a trailing newline; only normalize existing ones.
 */
export function normalizeText(text: string): string {
  // First collapse CRLF into a single LF, then convert remaining CR to LF.
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
