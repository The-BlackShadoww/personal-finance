/**
 * Debt payoff simulator. Each month: interest accrues (APR / 12), every
 * debt gets its minimum payment, and the rest of the budget — the extra
 * amount plus minimums freed up by debts already paid off — goes to the
 * target debt the strategy picks.
 */

export type Debt = {
  id: string;
  name: string;
  balanceCents: number;
  /** APR in basis points; null is treated as 0%. */
  aprBps: number | null;
  /** Null uses an assumed 2% of the starting balance. */
  minimumPaymentCents: number | null;
};

export type Strategy = "avalanche" | "snowball" | "minimum";

export type PayoffResult = {
  strategy: Strategy;
  /** Months until every debt is paid; null if not within the cap. */
  months: number | null;
  totalInterestCents: number;
  totalPaidCents: number;
  /** Month (1-based) each debt is paid off, null if never. */
  payoffMonth: Record<string, number | null>;
  /** Total owed at the end of each month, starting with month 0. */
  balances: number[];
  /** What the plan pays each debt in its first month. */
  firstMonthPayments: Record<string, number>;
  /** Debts whose minimum does not cover the first month's interest. */
  negativeAmortization: string[];
  /** Debts with no minimum entered (2% of the balance assumed). */
  assumedMinimums: string[];
};

/** The simulation stops after 50 years. */
export const MAX_MONTHS = 600;
const ASSUMED_MINIMUM_SHARE = 0.02;

const monthlyInterest = (balance: number, aprBps: number | null) =>
  Math.round((balance * (aprBps ?? 0)) / 10000 / 12);

export function minimumFor(debt: Debt) {
  return debt.minimumPaymentCents ?? Math.max(100, Math.round(debt.balanceCents * ASSUMED_MINIMUM_SHARE));
}

/** The order extra money is applied in. */
export function payoffOrder(debts: readonly Debt[], strategy: Strategy): Debt[] {
  const sorted = [...debts];
  if (strategy === "snowball") {
    sorted.sort((a, b) => a.balanceCents - b.balanceCents || (b.aprBps ?? 0) - (a.aprBps ?? 0));
  } else {
    // Avalanche (and the order leftover cents go in for "minimum").
    sorted.sort((a, b) => (b.aprBps ?? 0) - (a.aprBps ?? 0) || a.balanceCents - b.balanceCents);
  }
  return sorted;
}

export function simulatePayoff(debts: readonly Debt[], extraMonthlyCents: number, strategy: Strategy): PayoffResult {
  const active = debts.filter((debt) => debt.balanceCents > 0);
  const order = payoffOrder(active, strategy);
  const minimums = new Map(active.map((debt) => [debt.id, minimumFor(debt)]));
  const balance = new Map(active.map((debt) => [debt.id, debt.balanceCents]));
  const payoffMonth: Record<string, number | null> = Object.fromEntries(active.map((debt) => [debt.id, null]));
  const firstMonthPayments: Record<string, number> = {};
  // Minimums keep being paid in full after a debt is gone ("freed-up"
  // minimums roll over) for the two active strategies.
  const budget =
    strategy === "minimum" ? 0 : [...minimums.values()].reduce((sum, m) => sum + m, 0) + Math.max(0, extraMonthlyCents);

  const negativeAmortization = active
    .filter((debt) => (minimums.get(debt.id) ?? 0) <= monthlyInterest(debt.balanceCents, debt.aprBps))
    .map((debt) => debt.id);

  let totalInterest = 0;
  let totalPaid = 0;
  const balances = [sum(balance)];
  let month = 0;

  while (sum(balance) > 0 && month < MAX_MONTHS) {
    month += 1;
    for (const debt of order) {
      const owed = balance.get(debt.id) ?? 0;
      if (owed <= 0) continue;
      const interest = monthlyInterest(owed, debt.aprBps);
      totalInterest += interest;
      balance.set(debt.id, owed + interest);
    }

    const pay = (debt: Debt, amount: number) => {
      const owed = balance.get(debt.id) ?? 0;
      const paid = Math.min(owed, Math.max(0, amount));
      balance.set(debt.id, owed - paid);
      totalPaid += paid;
      if (month === 1) firstMonthPayments[debt.id] = (firstMonthPayments[debt.id] ?? 0) + paid;
      return paid;
    };

    let remaining = budget;
    for (const debt of order) {
      if ((balance.get(debt.id) ?? 0) <= 0) continue;
      const paid = pay(debt, minimums.get(debt.id) ?? 0);
      remaining -= paid;
    }
    if (strategy !== "minimum") {
      for (const debt of order) {
        if (remaining <= 0) break;
        if ((balance.get(debt.id) ?? 0) <= 0) continue;
        remaining -= pay(debt, remaining);
      }
    }

    for (const debt of order) {
      if (payoffMonth[debt.id] === null && (balance.get(debt.id) ?? 0) <= 0) payoffMonth[debt.id] = month;
    }
    balances.push(sum(balance));
  }

  return {
    strategy,
    months: sum(balance) > 0 ? null : month,
    totalInterestCents: totalInterest,
    totalPaidCents: totalPaid,
    payoffMonth,
    balances,
    firstMonthPayments,
    negativeAmortization,
    assumedMinimums: active.filter((debt) => debt.minimumPaymentCents === null).map((debt) => debt.id),
  };
}

function sum(values: Map<string, number>) {
  let total = 0;
  for (const value of values.values()) total += Math.max(0, value);
  return total;
}

/** All three strategies, plus interest saved against minimums only. */
export function comparePayoff(debts: readonly Debt[], extraMonthlyCents: number) {
  const minimum = simulatePayoff(debts, 0, "minimum");
  const avalanche = simulatePayoff(debts, extraMonthlyCents, "avalanche");
  const snowball = simulatePayoff(debts, extraMonthlyCents, "snowball");
  const saved = (result: PayoffResult) =>
    minimum.months === null ? null : minimum.totalInterestCents - result.totalInterestCents;
  return {
    minimum,
    avalanche: { ...avalanche, interestSavedCents: saved(avalanche) },
    snowball: { ...snowball, interestSavedCents: saved(snowball) },
  };
}
