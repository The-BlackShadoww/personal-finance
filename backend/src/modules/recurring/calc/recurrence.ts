export type Frequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

/** Safety cap on generated occurrences (≈ 96 years of weekly entries). */
const MAX_OCCURRENCES = 5000;

type Ymd = { year: number; month: number; day: number };

const parse = (iso: string): Ymd => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return { year, month, day };
};
const format = ({ year, month, day }: Ymd) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};
const DAY_STEP: Partial<Record<Frequency, number>> = {
  weekly: 7,
  biweekly: 14,
};

/**
 * The n-th occurrence (0 = the anchor). Month-based schedules keep the
 * anchor's day and clamp it to shorter months, so a rule anchored on the
 * 31st falls on 28/29 Feb and returns to the 31st in March.
 */
export function occurrenceAt(
  anchorDate: string,
  frequency: Frequency,
  n: number,
): string {
  const anchor = parse(anchorDate);
  const dayStep = DAY_STEP[frequency];
  if (dayStep) {
    const date = new Date(
      Date.UTC(anchor.year, anchor.month - 1, anchor.day + dayStep * n),
    );
    return date.toISOString().slice(0, 10);
  }
  const monthIndex =
    anchor.year * 12 + (anchor.month - 1) + MONTH_STEP[frequency]! * n;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return format({
    year,
    month,
    day: Math.min(anchor.day, daysInMonth(year, month)),
  });
}

/**
 * Occurrences on or after `from` and on or before `to` (and the end date),
 * oldest first. ISO dates compare correctly as strings.
 */
export function occurrencesBetween(
  rule: { anchorDate: string; frequency: Frequency; endDate: string | null },
  from: string,
  to: string,
): string[] {
  const last = rule.endDate && rule.endDate < to ? rule.endDate : to;
  const result: string[] = [];
  for (let n = 0; n < MAX_OCCURRENCES; n += 1) {
    const date = occurrenceAt(rule.anchorDate, rule.frequency, n);
    if (date > last) break;
    if (date >= from) result.push(date);
  }
  return result;
}

/** The first occurrence strictly after `date`, or null once the rule has ended. */
export function nextOccurrenceAfter(
  rule: { anchorDate: string; frequency: Frequency; endDate: string | null },
  date: string,
): string | null {
  for (let n = 0; n < MAX_OCCURRENCES; n += 1) {
    const occurrence = occurrenceAt(rule.anchorDate, rule.frequency, n);
    if (rule.endDate && occurrence > rule.endDate) return null;
    if (occurrence > date) return occurrence;
  }
  return null;
}

const PER_MONTH: Record<Frequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

/** Average monthly cost of a recurring amount, e.g. for subscription totals. */
export function monthlyEquivalent(
  amountCents: number,
  frequency: Frequency,
): number {
  return Math.round(amountCents * PER_MONTH[frequency]);
}

/** The billing month an occurrence counts toward. */
export function billingPeriod(
  date: string,
  offsetMonths: number,
): { year: number; month: number } {
  const { year, month } = parse(date);
  const index = year * 12 + (month - 1) + offsetMonths;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
