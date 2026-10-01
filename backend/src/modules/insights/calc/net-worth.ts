import type { AccountNature } from '../../accounts/account-kinds';

/** Cash flowing into (+) or out of (−) an account on a calendar day. */
export type DailyFlow = { day: string; flowCents: number };

/** A market value entered by the user for a date ("YYYY-MM-DD"). */
export type Valuation = { date: string; valueCents: number };

export type ValuedAccount = {
  nature: AccountNature;
  /** Natural balance today including every recorded entry. */
  currentBookCents: number;
  /** Oldest first. */
  flows: readonly DailyFlow[];
  /** Oldest first; assets only. */
  valuations: readonly Valuation[];
};

/** Σ flows on days strictly after `after` and on or before `upTo`. */
function flowBetween(
  flows: readonly DailyFlow[],
  after: string,
  upTo: string,
): number {
  let sum = 0;
  for (const flow of flows) {
    if (flow.day > after && flow.day <= upTo) sum += flow.flowCents;
  }
  return sum;
}

/** The natural (book) balance at the end of `day`. */
export function bookBalanceAt(account: ValuedAccount, day: string): number {
  const sign = account.nature === 'asset' ? 1 : -1;
  return (
    account.currentBookCents -
    sign * flowBetween(account.flows, day, '9999-12-31')
  );
}

/**
 * What the account was worth at the end of `day`: the latest valuation on or
 * before it plus money moved in or out since, or the book balance when it
 * has never been valued by then.
 */
export function valueAt(account: ValuedAccount, day: string): number {
  if (account.nature === 'asset') {
    let latest: Valuation | null = null;
    for (const valuation of account.valuations) {
      if (valuation.date <= day) latest = valuation;
    }
    if (latest) {
      return latest.valueCents + flowBetween(account.flows, latest.date, day);
    }
  }
  return bookBalanceAt(account, day);
}

/** Today's value, counting every recorded entry (future-dated ones too). */
export function currentValue(account: ValuedAccount): number {
  return valueAt(account, '9999-12-31');
}

/** "YYYY-MM-DD" of the last day of a "YYYY-MM" month. */
export function monthEnd(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

export type NetWorthPoint = {
  month: string;
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
};

/**
 * Month-end net worth for each "YYYY-MM" in `months`. The last point uses
 * today's values, so it always matches the current net worth.
 */
export function netWorthSeries(
  accounts: readonly ValuedAccount[],
  months: readonly string[],
): NetWorthPoint[] {
  return months.map((month, index) => {
    const isLast = index === months.length - 1;
    let assetsCents = 0;
    let liabilitiesCents = 0;
    for (const account of accounts) {
      const value = isLast
        ? currentValue(account)
        : valueAt(account, monthEnd(month));
      if (account.nature === 'asset') assetsCents += value;
      else liabilitiesCents += value;
    }
    return {
      month,
      assetsCents,
      liabilitiesCents,
      netWorthCents: assetsCents - liabilitiesCents,
    };
  });
}

/** Least-squares slope of evenly spaced values (change per step). */
export function slope(values: readonly number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, x) => {
    numerator += (x - meanX) * (value - meanY);
    denominator += (x - meanX) ** 2;
  });
  return numerator / denominator;
}
