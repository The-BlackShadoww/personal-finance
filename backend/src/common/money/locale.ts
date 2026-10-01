/** ISO 4217 codes the runtime can format. */
export const SUPPORTED_CURRENCIES: readonly string[] =
  Intl.supportedValuesOf('currency');

/** Canonical BCP 47 tag (e.g. "en-us" → "en-US"), or null when invalid. */
export function canonicalLocale(locale: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(locale);
    return canonical ?? null;
  } catch {
    return null;
  }
}
