/**
 * Spending insights, kept to a few so they are read rather than ignored:
 * category drift, unusual transactions, untracked subscriptions and
 * lifestyle creep.
 */

export type InsightKind =
  | 'category_drift'
  | 'unusual_transaction'
  | 'subscription'
  | 'lifestyle_creep';

export type SpendingInsight = {
  kind: InsightKind;
  title: string;
  detail: string;
  /** The money involved, for ranking and display. */
  amountCents: number;
  categoryId: string | null;
  transactionId: string | null;
  href: string;
};

export type CategorySpend = {
  categoryId: string;
  name: string;
  /** The three complete months before this one, oldest first. */
  previousCents: [number, number, number];
  /** This month so far. */
  currentCents: number;
};

export type ExpenseSample = {
  id: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  /** "YYYY-MM-DD". */
  date: string;
  note: string | null;
  /** Posted by a recurring rule. */
  recurring: boolean;
};

/** Thresholds from the plan's appendix. */
const DRIFT_RATIO = 1.25;
const DRIFT_INCOME_SHARE = 0.05;
const UNUSUAL_MIN_SAMPLES = 6;
const UNUSUAL_MADS = 3;
const SUBSCRIPTION_TOLERANCE = 0.05;
const SUBSCRIPTION_MIN_GAP = 25;
const SUBSCRIPTION_MAX_GAP = 35;
const SUBSCRIPTION_MIN_COUNT = 3;
const CREEP_INCOME_GROWTH = 0.05;
const CREEP_SHARE = 0.5;

export const MAX_INSIGHTS = 3;

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

const within = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) <= Math.max(a, b) * tolerance;

/**
 * Categories running well above their recent average this month: more than
 * 25% over, and the excess is more than 5% of monthly income.
 */
export function detectDrift(
  categories: readonly CategorySpend[],
  averageMonthlyIncomeCents: number | null,
): SpendingInsight[] {
  if (!averageMonthlyIncomeCents || averageMonthlyIncomeCents <= 0) return [];
  const results: SpendingInsight[] = [];
  for (const category of categories) {
    const average = category.previousCents.reduce((sum, c) => sum + c, 0) / 3;
    if (average <= 0) continue;
    const excess = category.currentCents - average;
    if (
      category.currentCents > average * DRIFT_RATIO &&
      excess > averageMonthlyIncomeCents * DRIFT_INCOME_SHARE
    ) {
      results.push({
        kind: 'category_drift',
        title: `${category.name} is running high`,
        detail: `Already ${Math.round((category.currentCents / average - 1) * 100)}% above your 3-month average this month.`,
        amountCents: Math.round(excess),
        categoryId: category.categoryId,
        transactionId: null,
        href: '/budgets',
      });
    }
  }
  return results;
}

/**
 * Recent expenses far above what the category usually costs: more than the
 * median plus three median absolute deviations of its other expenses, with
 * at least six to compare against.
 */
export function detectUnusual(
  samples: readonly ExpenseSample[],
  recentFrom: string,
): SpendingInsight[] {
  const byCategory = groupBy(samples, (sample) => sample.categoryId);
  const results: SpendingInsight[] = [];

  for (const sample of samples) {
    if (sample.date < recentFrom || sample.recurring) continue;
    const others = (byCategory.get(sample.categoryId) ?? [])
      .filter((other) => other.id !== sample.id)
      .map((other) => other.amountCents);
    if (others.length < UNUSUAL_MIN_SAMPLES) continue;

    const mid = median(others);
    // A floor on the spread so identical amounts (rent) do not flag a
    // slightly larger one.
    const mad = Math.max(
      median(others.map((a) => Math.abs(a - mid))),
      mid * 0.05,
    );
    if (sample.amountCents > mid + UNUSUAL_MADS * mad) {
      results.push({
        kind: 'unusual_transaction',
        title: `Unusually large ${sample.categoryName} expense`,
        detail: `${sample.note ? `"${sample.note}" ` : ''}on ${sample.date} is about ${(sample.amountCents / mid).toFixed(1)}× what ${sample.categoryName} usually costs.`,
        amountCents: Math.round(sample.amountCents - mid),
        categoryId: sample.categoryId,
        transactionId: sample.id,
        href: '/transactions',
      });
    }
  }
  return results;
}

/**
 * Expenses that repeat monthly at about the same amount (±5%, 25–35 days
 * apart, at least three times, the last in the past 40 days) and are not
 * yet a recurring rule.
 */
export function detectSubscriptions(
  samples: readonly ExpenseSample[],
  rules: ReadonlyArray<{ categoryId: string | null; amountCents: number }>,
  today: string,
): SpendingInsight[] {
  const results: SpendingInsight[] = [];
  const byCategory = groupBy(samples, (sample) => sample.categoryId);

  for (const [categoryId, list] of byCategory) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const used = new Set<string>();

    // Newest first, so each chain is anchored on its latest charge.
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const latest = sorted[i];
      if (used.has(latest.id) || daysBetween(latest.date, today) > 40) continue;

      const chain = [latest];
      let current = latest;
      for (let j = i - 1; j >= 0; j -= 1) {
        const candidate = sorted[j];
        const gap = daysBetween(candidate.date, current.date);
        if (gap > SUBSCRIPTION_MAX_GAP) break;
        if (
          gap >= SUBSCRIPTION_MIN_GAP &&
          within(
            candidate.amountCents,
            latest.amountCents,
            SUBSCRIPTION_TOLERANCE,
          )
        ) {
          chain.push(candidate);
          current = candidate;
        }
      }
      if (chain.length < SUBSCRIPTION_MIN_COUNT) continue;
      chain.forEach((item) => used.add(item.id));

      const tracked =
        chain.some((item) => item.recurring) ||
        rules.some(
          (rule) =>
            rule.categoryId === categoryId &&
            within(
              rule.amountCents,
              latest.amountCents,
              SUBSCRIPTION_TOLERANCE,
            ),
        );
      if (tracked) continue;

      const name = latest.note?.trim() || latest.categoryName;
      results.push({
        kind: 'subscription',
        title: `${name} looks like a subscription`,
        detail: `Charged ${chain.length} months in a row. Track it as recurring to see its yearly cost.`,
        amountCents: latest.amountCents * 12,
        categoryId,
        transactionId: latest.id,
        href: '/transactions?tab=recurring',
      });
    }
  }
  return results;
}

/**
 * Income rose more than 5% (last three complete months vs the three before)
 * and spending absorbed more than half of the rise.
 */
export function detectLifestyleCreep(
  monthlyIncomeCents: readonly number[],
  monthlyExpenseCents: readonly number[],
): SpendingInsight[] {
  if (monthlyIncomeCents.length < 6 || monthlyExpenseCents.length < 6)
    return [];
  const sum = (values: readonly number[]) =>
    values.reduce((total, v) => total + v, 0);
  const priorIncome = sum(monthlyIncomeCents.slice(-6, -3));
  const recentIncome = sum(monthlyIncomeCents.slice(-3));
  const priorExpense = sum(monthlyExpenseCents.slice(-6, -3));
  const recentExpense = sum(monthlyExpenseCents.slice(-3));

  const incomeRise = recentIncome - priorIncome;
  if (priorIncome <= 0 || incomeRise <= priorIncome * CREEP_INCOME_GROWTH)
    return [];
  const expenseRise = recentExpense - priorExpense;
  const share = expenseRise / incomeRise;
  if (share <= CREEP_SHARE) return [];

  return [
    {
      kind: 'lifestyle_creep',
      title: "You're spending more than half of your raise",
      detail: `Income is up about ${Math.round((incomeRise / priorIncome) * 100)}% on the previous three months, and spending took ${Math.min(100, Math.round(share * 100))}% of the increase. Saving at least half of a raise keeps progress going.`,
      amountCents: Math.round(expenseRise / 3),
      categoryId: null,
      transactionId: null,
      href: '/budgets',
    },
  ];
}

/** The most significant insights, creep first, then by amount. */
export function rankInsights(
  insights: readonly SpendingInsight[],
): SpendingInsight[] {
  return [...insights]
    .sort(
      (a, b) =>
        Number(b.kind === 'lifestyle_creep') -
          Number(a.kind === 'lifestyle_creep') || b.amountCents - a.amountCents,
    )
    .slice(0, MAX_INSIGHTS);
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}
