export function isInitializationReferenceError(error: unknown): boolean {
  if (!(error instanceof ReferenceError)) {
    return false;
  }
  return /before initialization/i.test(error.message);
}

export function formatFileLoadError(error: unknown, fileName?: string): string {
  const rawMessage =
    error instanceof Error ? error.message : "読み込みに失敗しました";
  const safeMessage = isInitializationReferenceError(error)
    ? "読み込みに失敗しました"
    : rawMessage;
  return fileName ? `${safeMessage} (${fileName})` : safeMessage;
}

export function shouldLogFileLoadError(error: unknown): boolean {
  return !isInitializationReferenceError(error);
}
