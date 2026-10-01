/**
 * Next Best Action: walks the money waterfall and returns the first step that
 * is not yet met, so the user sees one focus at a time.
 */

export type ActionKey =
  | 'cover_overspend'
  | 'start_tracking'
  | 'starter_buffer'
  | 'employer_match'
  | 'high_interest_debt'
  | 'emergency_fund'
  | 'invest_more'
  | 'sinking_fund'
  | 'protection'
  | 'on_track';

export type NextAction = {
  key: ActionKey;
  /** The waterfall step it serves (W1–W10), if any. */
  step: string | null;
  title: string;
  detail: string;
  /** The total still needed, if the action has one. */
  amountCents: number | null;
  /** A suggested monthly amount toward it. */
  monthlyCents: number | null;
  /** Months to finish at `monthlyCents`. */
  months: number | null;
  href: string;
  cta: string;
};

export type ActionInputs = {
  availableCents: number;
  /** At least three months of recorded income or spending. */
  hasHistory: boolean;
  averageMonthlyIncomeCents: number | null;
  /** Average monthly income minus spending; may be negative. */
  averageMonthlySurplusCents: number | null;
  emergency: {
    balanceCents: number;
    averageEssentialCents: number | null;
    targetMonths: number;
  };
  employerMatchPercent: number | null;
  /** Average monthly transfers into investment and retirement accounts. */
  investingMonthlyCents: number;
  /** Owed on debts charging 8% or more, highest rate first. */
  highInterestDebts: Array<{
    accountId: string;
    name: string;
    balanceCents: number;
    aprBps: number | null;
  }>;
  /** Sinking funds behind schedule for costs in the next 12 months. */
  sinkingBehind: Array<{
    goalId: string;
    name: string;
    shortfallMonthlyCents: number;
    targetDate: string;
  }>;
  protection: {
    hasHealthInsurance: boolean | null;
    hasLifeInsurance: boolean | null;
    dependents: number | null;
  };
};

/** Investing target as a share of income. */
const INVESTING_TARGET = 0.15;

/**
 * A monthly amount to put toward `neededCents`: the recent surplus if there
 * is one, otherwise a tenth of income.
 */
export function suggestPace(
  neededCents: number,
  surplusCents: number | null,
  incomeCents: number | null,
): { monthlyCents: number | null; months: number | null } {
  const monthly =
    surplusCents && surplusCents > 0
      ? Math.min(surplusCents, neededCents)
      : incomeCents && incomeCents > 0
        ? Math.min(Math.round(incomeCents / 10), neededCents)
        : 0;
  if (monthly <= 0 || neededCents <= 0)
    return { monthlyCents: null, months: null };
  return { monthlyCents: monthly, months: Math.ceil(neededCents / monthly) };
}

const action = (
  partial: Omit<NextAction, 'amountCents' | 'monthlyCents' | 'months'> &
    Partial<Pick<NextAction, 'amountCents' | 'monthlyCents' | 'months'>>,
): NextAction => ({
  amountCents: null,
  monthlyCents: null,
  months: null,
  ...partial,
});

export function nextBestAction(input: ActionInputs): NextAction {
  const income = input.averageMonthlyIncomeCents;
  const surplus = input.averageMonthlySurplusCents;
  const { emergency } = input;
  const essential = emergency.averageEssentialCents;

  if (input.availableCents < 0) {
    return action({
      key: 'cover_overspend',
      step: null,
      title: 'Cover the overspend',
      detail:
        'Spending has dipped into money set aside for goals. Move money back or withdraw from a goal on purpose.',
      amountCents: -input.availableCents,
      href: '/goals',
      cta: 'Review goals',
    });
  }

  if (!input.hasHistory || !income) {
    return action({
      key: 'start_tracking',
      step: null,
      title: 'Record a few months of income and spending',
      detail:
        'Advice gets specific once there are three months of history. Recurring salary and bills fill it in for you.',
      href: '/transactions?tab=recurring',
      cta: 'Set up recurring entries',
    });
  }

  if (essential && emergency.balanceCents < essential) {
    const needed = essential - emergency.balanceCents;
    return action({
      key: 'starter_buffer',
      step: 'W1',
      title: 'Build your one-month starter buffer',
      detail:
        'One month of essential spending, set aside, keeps a surprise bill from becoming debt.',
      amountCents: needed,
      ...suggestPace(needed, surplus, income),
      href: '/goals',
      cta: 'Add to emergency fund',
    });
  }

  const match = input.employerMatchPercent ?? 0;
  if (match > 0) {
    const matchMonthly = Math.round((income * match) / 100);
    if (input.investingMonthlyCents < matchMonthly) {
      return action({
        key: 'employer_match',
        step: 'W2',
        title: 'Capture your full employer match',
        detail: `Your employer matches up to ${match}% of pay. Contributing at least that much is an instant return.`,
        monthlyCents: matchMonthly - input.investingMonthlyCents,
        href: '/transactions?tab=recurring',
        cta: 'Set up a monthly contribution',
      });
    }
  }

  const [worstDebt] = input.highInterestDebts;
  if (worstDebt) {
    const rate =
      worstDebt.aprBps === null
        ? 'a high rate'
        : `${(worstDebt.aprBps / 100).toFixed(1)}% APR`;
    return action({
      key: 'high_interest_debt',
      step: 'W3',
      title: `Pay extra on ${worstDebt.name}`,
      detail: `It charges ${rate}. Paying it off first (the avalanche method) saves the most interest.`,
      amountCents: worstDebt.balanceCents,
      ...suggestPace(worstDebt.balanceCents, surplus, income),
      href: '/transactions?tab=recurring',
      cta: 'Schedule a payment',
    });
  }

  if (
    essential &&
    emergency.balanceCents < essential * emergency.targetMonths
  ) {
    const needed = essential * emergency.targetMonths - emergency.balanceCents;
    return action({
      key: 'emergency_fund',
      step: 'W4',
      title: 'Finish your emergency fund',
      detail: `${emergency.targetMonths} months of essential spending covers a job loss or a large repair.`,
      amountCents: needed,
      ...suggestPace(needed, surplus, income),
      href: '/goals',
      cta: 'Add to emergency fund',
    });
  }

  const investingTarget = Math.round(income * INVESTING_TARGET);
  if (input.investingMonthlyCents < investingTarget) {
    return action({
      key: 'invest_more',
      step: 'W5',
      title: 'Raise investing to 15% of income',
      detail:
        'Investing consistently, every month, is what builds long-term wealth. A recurring transfer on payday makes it automatic.',
      monthlyCents: investingTarget - input.investingMonthlyCents,
      href: '/transactions?tab=recurring',
      cta: 'Invest every payday',
    });
  }

  const [behind] = input.sinkingBehind;
  if (behind) {
    return action({
      key: 'sinking_fund',
      step: 'W6',
      title: `Top up ${behind.name}`,
      detail:
        'It is behind schedule for its date. Topping it up now avoids paying for it on credit.',
      monthlyCents: behind.shortfallMonthlyCents,
      href: '/goals',
      cta: 'Add money',
    });
  }

  const { protection } = input;
  const needsLife = (protection.dependents ?? 0) > 0;
  if (
    protection.hasHealthInsurance === false ||
    (needsLife && protection.hasLifeInsurance === false)
  ) {
    return action({
      key: 'protection',
      step: 'W7',
      title:
        protection.hasHealthInsurance === false
          ? 'Review health cover'
          : 'Review life cover',
      detail:
        protection.hasHealthInsurance === false
          ? 'A large medical bill is one of the most common ways savings get wiped out.'
          : 'Others depend on your income; life cover protects them if it stops.',
      href: '/settings?tab=financial',
      cta: 'Update your profile',
    });
  }

  return action({
    key: 'on_track',
    step: 'W10',
    title: "You're on track",
    detail:
      'The essentials are covered. Review your plan monthly and your investment mix once a year.',
    href: '/insights',
    cta: 'See your health score',
  });
}
