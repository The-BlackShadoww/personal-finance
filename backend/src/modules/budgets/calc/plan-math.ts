export type BudgetMethod =
  | 'zero_based'
  | 'fifty_thirty_twenty'
  | 'seventy_twenty_ten'
  | 'category_caps';

/**
 * One month of a category's budget history, oldest first. `amountCents` is
 * null when the month had no budget for the category.
 */
export type BudgetMonth = {
  amountCents: number | null;
  rollover: boolean;
  spentCents: number;
};

/**
 * Money available in the last month of `months`: its budget plus whatever
 * carried over. A month carries its leftover (or overspend, as a negative)
 * into the next month only when it had a budget with rollover on; a month
 * without a budget breaks the chain.
 */
export function availableWithRollover(months: readonly BudgetMonth[]): {
  carryCents: number;
  availableCents: number | null;
} {
  let carry = 0;
  let available: number | null = null;

  for (const [index, month] of months.entries()) {
    const isCurrent = index === months.length - 1;
    if (month.amountCents === null) {
      carry = 0;
      available = null;
      continue;
    }
    available = month.amountCents + carry;
    if (isCurrent) return { carryCents: carry, availableCents: available };
    carry = month.rollover ? available - month.spentCents : 0;
  }

  return { carryCents: 0, availableCents: available };
}

/** Median of the values (0 for an empty list), rounded to whole cents. */
export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export type BudgetStatus = 'none' | 'ok' | 'warning' | 'over';

/** Neutral until 80% of what is available is spent; over past 100%. */
export function budgetStatus(
  spentCents: number,
  availableCents: number | null,
): BudgetStatus {
  if (availableCents === null) return 'none';
  if (availableCents <= 0)
    return spentCents > 0 || availableCents < 0 ? 'over' : 'ok';
  const share = spentCents / availableCents;
  if (share > 1) return 'over';
  if (share >= 0.8) return 'warning';
  return 'ok';
}

export type Bucket = 'payFirst' | 'needs' | 'wants' | 'living';

export type MethodTarget = {
  bucket: Bucket;
  /** Percent of expected income. */
  percent: number;
  /** Saving is a floor; spending is a ceiling. */
  kind: 'min' | 'max';
};

export const METHOD_TARGETS: Record<BudgetMethod, MethodTarget[]> = {
  fifty_thirty_twenty: [
    { bucket: 'payFirst', percent: 20, kind: 'min' },
    { bucket: 'needs', percent: 50, kind: 'max' },
    { bucket: 'wants', percent: 30, kind: 'max' },
  ],
  // The remaining 10% goes to extra debt payments and giving.
  seventy_twenty_ten: [
    { bucket: 'payFirst', percent: 20, kind: 'min' },
    { bucket: 'living', percent: 70, kind: 'max' },
  ],
  zero_based: [],
  category_caps: [],
};

export type BucketAmounts = { payFirst: number; needs: number; wants: number };

export type TargetCheck = MethodTarget & {
  targetCents: number;
  plannedCents: number;
  actualCents: number;
  /** Does the plan respect the target? */
  plannedOk: boolean;
  /** Has the month so far respected it? Spending ceilings only; saving floors wait for the month to end. */
  actualOk: boolean;
};

const bucketValue = (amounts: BucketAmounts, bucket: Bucket) =>
  bucket === 'living' ? amounts.needs + amounts.wants : amounts[bucket];

/**
 * Compares a month's plan and actuals with the method's targets, and works
 * out how much expected income is still unassigned.
 */
export function evaluatePlan({
  method,
  incomeCents,
  planned,
  actual,
}: {
  method: BudgetMethod;
  incomeCents: number;
  planned: BucketAmounts;
  actual: BucketAmounts;
}): { leftToAssignCents: number; checks: TargetCheck[] } {
  const leftToAssignCents =
    incomeCents - planned.payFirst - planned.needs - planned.wants;

  const checks = METHOD_TARGETS[method].map((target) => {
    const targetCents = Math.round((incomeCents * target.percent) / 100);
    const plannedCents = bucketValue(planned, target.bucket);
    const actualCents = bucketValue(actual, target.bucket);
    return {
      ...target,
      targetCents,
      plannedCents,
      actualCents,
      plannedOk:
        target.kind === 'min'
          ? plannedCents >= targetCents
          : plannedCents <= targetCents,
      actualOk: target.kind === 'min' ? true : actualCents <= targetCents,
    };
  });

  return { leftToAssignCents, checks };
}
