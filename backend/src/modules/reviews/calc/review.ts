/**
 * The monthly review's generated content: three wins, three leaks and the
 * discretionary categories to rate. Neutral wording throughout: an overspend
 * is something to rebalance, not a failure.
 */

export type ReviewItem = {
  kind:
    | 'savings_rate'
    | 'under_budget'
    | 'goals'
    | 'invested'
    | 'debt_repaid'
    | 'net_worth'
    | 'over_budget'
    | 'category_drift'
    | 'new_subscription'
    | 'lifestyle_creep';
  title: string;
  detail: string;
  amountCents: number;
};

export type ReviewCategory = {
  categoryId: string;
  name: string;
  essential: boolean;
  /** Budget available this month (with rollover); null without a budget. */
  availableCents: number | null;
  spentCents: number;
  /** Average of the three months before. */
  averageCents: number;
};

export type ReviewInputs = {
  incomeCents: number;
  expenseCents: number;
  netWorthChangeCents: number | null;
  categories: readonly ReviewCategory[];
  goalContributionCents: number;
  investedCents: number;
  debtRepaidCents: number;
  newSubscriptions: ReadonlyArray<{ name: string; monthlyCents: number }>;
  /** A lifestyle-creep finding for the months ending this one, if any. */
  creep: { title: string; detail: string; amountCents: number } | null;
};

export const REVIEW_ITEMS = 3;
export const WORTH_IT_CATEGORIES = 5;
const SAVINGS_TARGET = 0.2;
const DRIFT_RATIO = 1.25;
const DRIFT_INCOME_SHARE = 0.05;

type Money = (cents: number) => string;

const top = (items: ReviewItem[]) =>
  items.sort((a, b) => b.amountCents - a.amountCents).slice(0, REVIEW_ITEMS);

export function buildWins(input: ReviewInputs, money: Money): ReviewItem[] {
  const wins: ReviewItem[] = [];
  const saved = input.incomeCents - input.expenseCents;

  if (input.incomeCents > 0 && saved >= input.incomeCents * SAVINGS_TARGET) {
    wins.push({
      kind: 'savings_rate',
      title: `Kept ${Math.round((saved / input.incomeCents) * 100)}% of your income`,
      detail: `${money(saved)} not spent, above the 20% target.`,
      amountCents: saved,
    });
  }

  const underBudget = input.categories
    .filter(
      (c) =>
        c.availableCents !== null &&
        c.availableCents > 0 &&
        c.spentCents <= c.availableCents,
    )
    .map((c) => ({
      category: c,
      left: (c.availableCents as number) - c.spentCents,
    }))
    .filter(({ left }) => left > 0)
    .sort((a, b) => b.left - a.left)
    .slice(0, 2);
  for (const { category, left } of underBudget) {
    wins.push({
      kind: 'under_budget',
      title: `Stayed within ${category.name}`,
      detail: `${money(left)} of its budget left over.`,
      amountCents: left,
    });
  }

  if (input.goalContributionCents > 0) {
    wins.push({
      kind: 'goals',
      title: `Set aside ${money(input.goalContributionCents)} for goals`,
      detail: 'Paying yourself first, before spending.',
      amountCents: input.goalContributionCents,
    });
  }
  if (input.investedCents > 0) {
    wins.push({
      kind: 'invested',
      title: `Invested ${money(input.investedCents)}`,
      detail: 'Another month of steady investing.',
      amountCents: input.investedCents,
    });
  }
  if (input.debtRepaidCents > 0) {
    wins.push({
      kind: 'debt_repaid',
      title: `Paid ${money(input.debtRepaidCents)} off debt`,
      detail: 'Less owed means less interest next month.',
      amountCents: input.debtRepaidCents,
    });
  }
  if (input.netWorthChangeCents !== null && input.netWorthChangeCents > 0) {
    wins.push({
      kind: 'net_worth',
      title: `Net worth up ${money(input.netWorthChangeCents)}`,
      detail: 'What you own minus what you owe grew this month.',
      amountCents: input.netWorthChangeCents,
    });
  }

  return top(wins);
}

export function buildLeaks(input: ReviewInputs, money: Money): ReviewItem[] {
  const leaks: ReviewItem[] = [];
  const over = new Set<string>();

  for (const category of input.categories) {
    if (category.availableCents === null) continue;
    const overBy = category.spentCents - Math.max(0, category.availableCents);
    if (overBy > 0) {
      over.add(category.categoryId);
      leaks.push({
        kind: 'over_budget',
        title: `${category.name} went over budget`,
        detail: `${money(overBy)} more than planned. Move money from another category, or plan for it next month.`,
        amountCents: overBy,
      });
    }
  }

  for (const category of input.categories) {
    if (over.has(category.categoryId) || category.averageCents <= 0) continue;
    const excess = category.spentCents - category.averageCents;
    if (
      category.spentCents > category.averageCents * DRIFT_RATIO &&
      excess > input.incomeCents * DRIFT_INCOME_SHARE
    ) {
      leaks.push({
        kind: 'category_drift',
        title: `${category.name} ran above usual`,
        detail: `${money(excess)} more than your 3-month average.`,
        amountCents: excess,
      });
    }
  }

  for (const subscription of input.newSubscriptions) {
    leaks.push({
      kind: 'new_subscription',
      title: `New subscription: ${subscription.name}`,
      detail: `${money(subscription.monthlyCents)} a month is ${money(subscription.monthlyCents * 12)} a year. Still worth it?`,
      amountCents: subscription.monthlyCents * 12,
    });
  }

  const ranked = top(leaks);
  if (!input.creep) return ranked;
  const creep: ReviewItem = { kind: 'lifestyle_creep', ...input.creep };
  return [creep, ...ranked].slice(0, REVIEW_ITEMS);
}

/** The biggest discretionary categories this month, to rate "worth it?". */
export function worthItCandidates(categories: readonly ReviewCategory[]) {
  return categories
    .filter((c) => !c.essential && c.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents)
    .slice(0, WORTH_IT_CATEGORIES)
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      spentCents: c.spentCents,
    }));
}

export type WorthIt = 'yes' | 'meh' | 'no';

/**
 * Categories rated "no" in this review and at least once in the reviews
 * before: worth lowering the budget for next month (spend on what you value).
 */
export function repeatedNo(
  current: Readonly<Record<string, WorthIt>>,
  previous: ReadonlyArray<Readonly<Record<string, WorthIt>>>,
): string[] {
  return Object.entries(current)
    .filter(
      ([id, rating]) => rating === 'no' && previous.some((p) => p[id] === 'no'),
    )
    .map(([id]) => id);
}
