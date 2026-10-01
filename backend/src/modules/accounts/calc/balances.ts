import type { AccountNature } from '../account-kinds';

/**
 * One side of a ledger entry from an account's point of view, as cash
 * flowing in (+) or out (−) of it:
 * - income into the account: +amount
 * - expense from the account: −amount
 * - transfer out of the account: −amount
 * - transfer into the account: +amount
 */
export type MonthlyFlow = {
  /** "YYYY-MM" in the user's timezone. */
  month: string;
  flowCents: number;
};

/**
 * The balance in natural terms: what is owned for assets, what is owed for
 * liabilities. Money flowing into a credit card (a payment) lowers what is
 * owed; spending on it (an outflow) raises it.
 */
export function naturalBalance(
  nature: AccountNature,
  openingBalanceCents: number,
  netFlowCents: number,
): number {
  return nature === 'asset'
    ? openingBalanceCents + netFlowCents
    : openingBalanceCents - netFlowCents;
}

/** Contribution of an account's natural balance to net worth. */
export function netWorthContribution(
  nature: AccountNature,
  balanceCents: number,
): number {
  return nature === 'asset' ? balanceCents : -balanceCents;
}

/** The `count` months ending with `current` ("YYYY-MM"), oldest first. */
export function trailingMonths(current: string, count: number): string[] {
  const [year, month] = current.split('-').map(Number);
  const end = year * 12 + (month - 1);
  return Array.from({ length: count }, (_value, index) => {
    const monthIndex = end - (count - 1) + index;
    const y = Math.floor(monthIndex / 12);
    const m = (monthIndex % 12) + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  });
}

/**
 * Month-end natural balances for the trailing months, derived backwards from
 * the current balance so they always agree with it. Flows dated after the
 * current month (future-dated entries) are part of the current balance and
 * are attributed to the last month.
 */
export function balanceTrend(
  nature: AccountNature,
  currentBalanceCents: number,
  flows: readonly MonthlyFlow[],
  months: readonly string[],
): Array<{ month: string; balanceCents: number }> {
  const sign = nature === 'asset' ? 1 : -1;
  const byMonth = new Map<string, number>();
  for (const { month, flowCents } of flows) {
    byMonth.set(month, (byMonth.get(month) ?? 0) + flowCents);
  }

  const result: Array<{ month: string; balanceCents: number }> = [];
  let balance = currentBalanceCents;
  // Walk newest → oldest: a month's end balance is the next month's end
  // balance minus that next month's change.
  for (let index = months.length - 1; index >= 0; index -= 1) {
    result.unshift({ month: months[index], balanceCents: balance });
    balance -= sign * (byMonth.get(months[index]) ?? 0);
  }
  return result;
}
