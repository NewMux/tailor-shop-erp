export function getTranslationSource(
  currentText: string,
  originalText: string | undefined,
  lastTranslatedText: string | undefined,
): string {
  return originalText !== undefined && currentText === lastTranslatedText ? originalText : currentText;
}

export function getTranslatedText(
  currentText: string,
  originalText: string | undefined,
  lastTranslatedText: string | undefined,
  translate: (value: string) => string,
): string {
  return translate(getTranslationSource(currentText, originalText, lastTranslatedText));
}
