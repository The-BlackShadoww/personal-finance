export type MoneyFormat = {
  currency: string;
  locale: string;
};

/**
 * Formats stored cents as money in the user's currency and locale, e.g.
 * "৳1,500.50" or "₹12,34,567.50". Amounts are always stored in hundredths, so
 * zero-decimal currencies (JPY) are rounded for display.
 *
 * `forPdf` adapts the output to the built-in PDF font and layout:
 * - symbols Helvetica cannot draw (৳, ₹, ₦ …) become the ISO code,
 *   e.g. "BDT 1,500.50";
 * - no-break spaces become normal spaces, so a long amount in a narrow
 *   column wraps after the code instead of being split mid-number.
 */
export function formatMoney(
  cents: number,
  { currency, locale }: MoneyFormat,
  { forPdf = false }: { forPdf?: boolean } = {},
): string {
  const format = (currencyDisplay: 'narrowSymbol' | 'code') =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
      // Latin digits, matching the web app.
      numberingSystem: 'latn',
    }).format(cents / 100);

  const withSymbol = format('narrowSymbol');

  if (!forPdf) {
    return withSymbol;
  }

  // Helvetica (WinAnsi) covers Latin-1 plus the euro sign.
  const drawable = (char: string) =>
    char.codePointAt(0)! <= 0xff || char === '€';
  const text = [...withSymbol].every(drawable) ? withSymbol : format('code');

  return text.replace(/[\u00a0\u202f]/g, ' ');
}
