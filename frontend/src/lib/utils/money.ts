// Money formatting in the signed-in user's currency and locale.
//
// The active format is module state rather than React context so the many
// plain helpers (chart ticks, table cells) keep a simple signature. It is set
// by <MoneyFormatProvider>, which remounts the app subtree when it changes so
// everything re-renders with the new format.

export type MoneyFormat = {
  currency: string;
  locale: string;
};

export const DEFAULT_MONEY_FORMAT: MoneyFormat = { currency: "USD", locale: "en-US" };

let active: MoneyFormat = DEFAULT_MONEY_FORMAT;
const formatters = new Map<string, Intl.NumberFormat>();

export function getMoneyFormat(): MoneyFormat {
  return active;
}

export function setMoneyFormat(next: MoneyFormat) {
  if (next.currency === active.currency && next.locale === active.locale) return;
  active = next;
  formatters.clear();
}

function formatter(key: string, options: Intl.NumberFormatOptions) {
  const cacheKey = `${active.currency}|${active.locale}|${key}`;
  let cached = formatters.get(cacheKey);
  if (!cached) {
    try {
      cached = new Intl.NumberFormat(active.locale, {
        style: "currency",
        currency: active.currency,
        // "৳" rather than "BDT", "$" rather than "US$".
        currencyDisplay: "narrowSymbol",
        // Latin digits everywhere, so typed amounts parse the same in every locale.
        numberingSystem: "latn",
        ...options,
      });
    } catch {
      cached = new Intl.NumberFormat(DEFAULT_MONEY_FORMAT.locale, {
        style: "currency",
        currency: DEFAULT_MONEY_FORMAT.currency,
        ...options,
      });
    }
    formatters.set(cacheKey, cached);
  }
  return cached;
}

/** Signed amount in major units: 1500.5 → "৳1,500.50". */
export function formatMoney(amount: number, fractionDigits: 0 | 2 = 2): string {
  return formatter(`fixed${fractionDigits}`, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Magnitude only, for UIs that show the sign or direction separately. */
export function formatMoneyAbs(amount: number, fractionDigits: 0 | 2 = 2): string {
  return formatMoney(Math.abs(amount), fractionDigits);
}

/** Signed amount stored in cents (the API's `*Cents` fields). */
export function formatCents(cents: number, fractionDigits: 0 | 2 = 2): string {
  return formatMoney(cents / 100, fractionDigits);
}

/** Short form for chart axes: 12500 → "৳13K" (or locale equivalent). */
export function formatCompactMoney(amount: number): string {
  return formatter("compact", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** The currency symbol alone, for input prefixes: "৳", "$", "€". */
export function currencySymbol(): string {
  return (
    formatter("fixed2", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? active.currency
  );
}

/**
 * Parses a typed amount. Empty → null; otherwise a number, or NaN when
 * invalid. Accepts grouping commas ("1,250.50") and a decimal comma
 * ("1250,50").
 */
export function parseAmountInput(raw: string): number | null {
  const compact = raw.trim().replace(/\s/g, "");
  if (compact === "") return null;
  // The last separator is the decimal one when 1–2 digits follow it
  // ("1.250,50"); otherwise commas group thousands ("1,250").
  const decimalComma = compact.lastIndexOf(",") > compact.lastIndexOf(".") && /,\d{1,2}$/.test(compact);
  return Number(decimalComma ? compact.replace(/\./g, "").replace(",", ".") : compact.replace(/,/g, ""));
}
