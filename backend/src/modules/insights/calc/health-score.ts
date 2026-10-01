import { slope } from './net-worth';

/**
 * Financial health score. Each metric is scored 0–100 by linear
 * interpolation between a "poor" and a "healthy" anchor, then weighted.
 * Metrics without enough data are left out and the weights re-normalised.
 * Ratios use take-home income, which makes every threshold stricter than the
 * classic gross-income rules.
 */

export type MetricKey =
  | 'savings_rate'
  | 'investing_rate'
  | 'emergency_cover'
  | 'debt_service'
  | 'high_interest_debt'
  | 'housing_cost'
  | 'fixed_costs'
  | 'net_worth_trend'
  | 'protection';

export type MetricUnit =
  | 'percent'
  | 'months'
  | 'cents'
  | 'cents_per_month'
  | 'share';

export type HealthMetric = {
  key: MetricKey;
  label: string;
  weight: number;
  /** False when there is not enough data; then value and score are null. */
  available: boolean;
  value: number | null;
  unit: MetricUnit;
  /** The anchor that scores 0. */
  poor: number;
  /** The anchor that scores 100. */
  healthy: number;
  score: number | null;
  /** One line on how to improve, or why it is unavailable. */
  tip: string;
};

export type HealthBand = 'building' | 'stable' | 'strong' | 'thriving';

export type HealthScore = {
  /** Null when no metric has data. */
  score: number | null;
  band: HealthBand | null;
  metrics: HealthMetric[];
};

export type HealthInputs = {
  /** At least three months of recorded income or spending. */
  hasHistory: boolean;
  /** Totals over the trailing three complete months. */
  trailing: {
    incomeCents: number;
    expenseCents: number;
    investingCents: number;
    /** Transfers onto credit cards and loans. */
    debtPaymentCents: number;
    debtInterestCents: number;
    housingCents: number;
    fixedCents: number;
  };
  emergency: {
    balanceCents: number;
    averageEssentialCents: number | null;
    targetMonths: number;
  };
  /** Total owed on debts charging 8% APR or more. */
  highInterestDebtCents: number;
  /** Month-end net worth for the last seven month-ends, oldest first. */
  netWorthMonthEnds: number[];
  averageMonthlyIncomeCents: number | null;
  protection: {
    hasHealthInsurance: boolean | null;
    hasLifeInsurance: boolean | null;
    dependents: number | null;
  };
};

/** 0 at `poor`, 100 at `healthy`, clamped; works for falling scales too. */
export function interpolate(value: number, poor: number, healthy: number) {
  if (poor === healthy) return value >= healthy ? 100 : 0;
  const t = (value - poor) / (healthy - poor);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}

export function bandFor(score: number): HealthBand {
  if (score >= 85) return 'thriving';
  if (score >= 70) return 'strong';
  if (score >= 40) return 'stable';
  return 'building';
}

const percentOf = (part: number, whole: number) =>
  Math.round((part / whole) * 1000) / 10;

const NOT_ENOUGH_HISTORY =
  'Needs three months of recorded income and spending.';

type Draft = Omit<HealthMetric, 'score' | 'available'> & {
  available?: boolean;
};

function finish(draft: Draft): HealthMetric {
  const available = draft.available !== false && draft.value !== null;
  return {
    ...draft,
    available,
    value: available ? draft.value : null,
    score: available
      ? interpolate(draft.value as number, draft.poor, draft.healthy)
      : null,
  };
}

export function scoreHealth(input: HealthInputs): HealthScore {
  const { trailing, emergency, protection } = input;
  const income = trailing.incomeCents;
  const withIncome = input.hasHistory && income > 0;
  const ratio = (cents: number) =>
    withIncome ? percentOf(cents, income) : null;

  const savingsRate = ratio(income - trailing.expenseCents);
  const investingRate = ratio(trailing.investingCents);
  const debtService = ratio(
    trailing.debtPaymentCents + trailing.debtInterestCents,
  );
  const housing = ratio(trailing.housingCents);
  const fixed = ratio(trailing.fixedCents);

  const cover =
    emergency.averageEssentialCents && emergency.averageEssentialCents > 0
      ? Math.round(
          (emergency.balanceCents / emergency.averageEssentialCents) * 10,
        ) / 10
      : null;

  const monthlyIncome = input.averageMonthlyIncomeCents;
  const trend =
    input.hasHistory && monthlyIncome && monthlyIncome > 0
      ? slope(input.netWorthMonthEnds)
      : null;

  const needsLife = (protection.dependents ?? 0) > 0;
  const protectionKnown =
    protection.hasHealthInsurance !== null &&
    protection.dependents !== null &&
    (!needsLife || protection.hasLifeInsurance !== null);
  const covers = [
    protection.hasHealthInsurance,
    ...(needsLife ? [protection.hasLifeInsurance] : []),
  ];
  const protectionShare = protectionKnown
    ? Math.round((covers.filter(Boolean).length / covers.length) * 100)
    : null;

  const metrics: HealthMetric[] = [
    finish({
      key: 'savings_rate',
      label: 'Savings rate',
      weight: 20,
      value: savingsRate,
      unit: 'percent',
      poor: 0,
      healthy: 20,
      tip: withIncome
        ? 'Keep at least a fifth of take-home pay: automate a transfer on payday.'
        : NOT_ENOUGH_HISTORY,
    }),
    finish({
      key: 'investing_rate',
      label: 'Investing rate',
      weight: 10,
      value: investingRate,
      unit: 'percent',
      poor: 0,
      healthy: 15,
      tip: withIncome
        ? 'Move 15% of income into investment or retirement accounts every month.'
        : NOT_ENOUGH_HISTORY,
    }),
    finish({
      key: 'emergency_cover',
      label: 'Emergency cover',
      weight: 20,
      value: cover,
      unit: 'months',
      poor: 0,
      healthy: emergency.targetMonths,
      tip:
        cover === null
          ? 'Needs recorded spending on essential categories to size the fund.'
          : `Build the emergency fund to ${emergency.targetMonths} months of essential spending.`,
    }),
    finish({
      key: 'debt_service',
      label: 'Debt payments',
      weight: 15,
      value: debtService,
      unit: 'percent',
      poor: 50,
      healthy: 15,
      tip: withIncome
        ? 'Keep card and loan payments, interest included, under 15% of income.'
        : NOT_ENOUGH_HISTORY,
    }),
    finish({
      key: 'high_interest_debt',
      label: 'High-interest debt',
      weight: 10,
      value: input.highInterestDebtCents,
      unit: 'cents',
      // Binary: any balance scores 0, none scores 100.
      poor: 1,
      healthy: 0,
      tip: 'Clear debts charging 8% or more, highest rate first.',
    }),
    finish({
      key: 'housing_cost',
      label: 'Housing cost',
      weight: 5,
      value: housing,
      unit: 'percent',
      poor: 50,
      healthy: 30,
      tip: withIncome
        ? 'Aim for housing at or under 30% of take-home pay. Tag rent or mortgage categories as housing.'
        : NOT_ENOUGH_HISTORY,
    }),
    finish({
      key: 'fixed_costs',
      label: 'Fixed costs',
      weight: 5,
      value: fixed,
      unit: 'percent',
      poor: 80,
      healthy: 50,
      tip: withIncome
        ? 'Keep fixed bills at or under half of income so a bad month stays manageable.'
        : NOT_ENOUGH_HISTORY,
    }),
    finish({
      key: 'net_worth_trend',
      label: 'Net worth trend',
      weight: 10,
      value: trend === null ? null : Math.round(trend),
      unit: 'cents_per_month',
      // A tenth of monthly income lost or gained per month.
      poor: monthlyIncome ? -Math.round(monthlyIncome / 10) : -1,
      healthy: monthlyIncome ? Math.round(monthlyIncome / 10) : 1,
      tip:
        trend === null
          ? NOT_ENOUGH_HISTORY
          : 'Grow net worth each month by saving, investing and paying down debt.',
    }),
    finish({
      key: 'protection',
      label: 'Insurance',
      weight: 5,
      value: protectionShare,
      unit: 'share',
      poor: 0,
      healthy: 100,
      tip: protectionKnown
        ? needsLife
          ? 'Health cover for you, and life cover while others depend on your income.'
          : 'Keep health cover in place.'
        : 'Answer the insurance questions in your financial profile.',
    }),
  ];

  const scored = metrics.filter((metric) => metric.available);
  const totalWeight = scored.reduce((sum, metric) => sum + metric.weight, 0);
  if (!totalWeight) return { score: null, band: null, metrics };

  const score = Math.round(
    scored.reduce(
      (sum, metric) => sum + (metric.score as number) * metric.weight,
      0,
    ) / totalWeight,
  );
  return { score, band: bandFor(score), metrics };
}
