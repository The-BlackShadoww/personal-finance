export type FundingRule = 'percent_of_income' | 'fixed_monthly' | 'manual';

export type FundableGoal = {
  id: string;
  fundingRule: FundingRule;
  fundingPercentBps: number | null;
  fundingAmountCents: number | null;
  /** Null when the goal has no target (no cap). */
  remainingToTargetCents: number | null;
  /** Auto contributions already made in the income's billing month. */
  autoThisPeriodCents: number;
};

/**
 * Pay yourself first: shares an income out to goals in priority order
 * (`goals` must already be sorted). Percent goals take their share of the
 * income; fixed-monthly goals take whatever their monthly amount still lacks
 * this period. No goal is filled past its target, and the total never
 * exceeds the income.
 */
export function allocateIncome(
  incomeCents: number,
  goals: readonly FundableGoal[],
): Array<{ goalId: string; amountCents: number }> {
  let remaining = incomeCents;
  const result: Array<{ goalId: string; amountCents: number }> = [];

  for (const goal of goals) {
    if (remaining <= 0) break;

    let wanted = 0;
    if (goal.fundingRule === 'percent_of_income' && goal.fundingPercentBps) {
      wanted = Math.round((incomeCents * goal.fundingPercentBps) / 10000);
    } else if (
      goal.fundingRule === 'fixed_monthly' &&
      goal.fundingAmountCents
    ) {
      wanted = Math.max(0, goal.fundingAmountCents - goal.autoThisPeriodCents);
    }

    if (goal.remainingToTargetCents !== null) {
      wanted = Math.min(wanted, Math.max(0, goal.remainingToTargetCents));
    }
    const amount = Math.min(wanted, remaining);

    if (amount > 0) {
      result.push({ goalId: goal.id, amountCents: amount });
      remaining -= amount;
    }
  }

  return result;
}

/**
 * Average monthly essential spending over consecutive months (oldest
 * first). Months before the first recorded spending are ignored so a new
 * user's empty history does not drag the average down. Null with no data.
 */
export function averageMonthlyEssential(
  monthlyCents: readonly number[],
): number | null {
  const first = monthlyCents.findIndex((cents) => cents > 0);
  if (first === -1) return null;
  const months = monthlyCents.slice(first);
  return Math.round(
    months.reduce((sum, cents) => sum + cents, 0) / months.length,
  );
}

/** Months of cover for a target size: 6 for irregular income, otherwise 3. */
export function defaultEmergencyMonths(
  incomeStability: 'stable' | 'variable' | null,
) {
  return incomeStability === 'variable' ? 6 : 3;
}

type YearMonth = { year: number; month: number };

const toIndex = ({ year, month }: YearMonth) => year * 12 + (month - 1);

function parseDate(value: string): YearMonth & { day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

/**
 * For yearly sinking funds, a target date in an earlier month rolls forward
 * by whole years to the next occurrence.
 */
export function effectiveTargetDate(
  targetDate: string | null,
  repeatsYearly: boolean,
  today: YearMonth,
): string | null {
  if (!targetDate || !repeatsYearly) return targetDate;
  const date = parseDate(targetDate);
  let year = date.year;
  while (toIndex({ year, month: date.month }) < toIndex(today)) year += 1;
  return `${year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

/** Months left to save, counting the current month and the target month. */
export function monthsToSave(today: YearMonth, targetDate: string): number {
  const target = parseDate(targetDate);
  return Math.max(1, toIndex(target) - toIndex(today) + 1);
}

export type GoalStatus = 'done' | 'ahead' | 'on_track' | 'behind' | 'open';

export type GoalProgress = {
  /** 0–100, null without a target. */
  percent: number | null;
  /** Needed per month to hit the target by its date. */
  requiredMonthlyCents: number | null;
  /** "YYYY-MM" the target is reached at the current pace. */
  projectedCompletion: string | null;
  status: GoalStatus;
};

/**
 * Progress against a target given the recent monthly pace of contributions.
 * "Ahead" means the pace beats what is required by at least a quarter.
 */
export function goalProgress({
  balanceCents,
  targetCents,
  targetDate,
  paceMonthlyCents,
  today,
}: {
  balanceCents: number;
  targetCents: number | null;
  targetDate: string | null;
  paceMonthlyCents: number;
  today: YearMonth;
}): GoalProgress {
  if (targetCents === null || targetCents <= 0) {
    return {
      percent: null,
      requiredMonthlyCents: null,
      projectedCompletion: null,
      status: 'open',
    };
  }

  const percent = Math.min(
    100,
    Math.max(0, Math.round((balanceCents / targetCents) * 100)),
  );
  const remaining = targetCents - balanceCents;
  if (remaining <= 0) {
    return {
      percent: 100,
      requiredMonthlyCents: 0,
      projectedCompletion: null,
      status: 'done',
    };
  }

  let projectedCompletion: string | null = null;
  if (paceMonthlyCents > 0) {
    // Contributions start this month, as in monthsToSave.
    const index = toIndex(today) + Math.ceil(remaining / paceMonthlyCents) - 1;
    projectedCompletion = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  }

  if (!targetDate) {
    return {
      percent,
      requiredMonthlyCents: null,
      projectedCompletion,
      status: 'open',
    };
  }

  const requiredMonthlyCents = Math.ceil(
    remaining / monthsToSave(today, targetDate),
  );
  const status: GoalStatus =
    paceMonthlyCents >= requiredMonthlyCents * 1.25
      ? 'ahead'
      : paceMonthlyCents >= requiredMonthlyCents
        ? 'on_track'
        : 'behind';

  return { percent, requiredMonthlyCents, projectedCompletion, status };
}
