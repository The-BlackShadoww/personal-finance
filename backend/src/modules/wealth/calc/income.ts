/**
 * Income tracking (W8): where income comes from, how concentrated it is,
 * how much of spending passive income covers, and how fast it grows.
 */

export type IncomeKind = 'active' | 'passive' | 'portfolio' | 'unclassified';

export type CategoryIncome = {
  categoryId: string;
  name: string;
  kind: IncomeKind;
  /** Income per month for the last 24 complete months, oldest first. */
  monthlyCents: readonly number[];
};

/** A source counts as active when it paid in at least 3 of the last 6 months. */
const ACTIVE_SOURCE_MONTHS = 3;
/** One source above this share of income is a concentration risk. */
export const CONCENTRATION_SHARE = 0.8;

const sum = (values: readonly number[]) =>
  values.reduce((total, v) => total + v, 0);
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

export function incomeSummary(
  categories: readonly CategoryIncome[],
  trailingExpenseCents: number,
) {
  const last12 = (c: CategoryIncome) => sum(c.monthlyCents.slice(-12));
  const prior12 = (c: CategoryIncome) => sum(c.monthlyCents.slice(-24, -12));
  const total12 = sum(categories.map(last12));
  const totalPrior12 = sum(categories.map(prior12));

  const byKind: Record<IncomeKind, number> = {
    active: 0,
    passive: 0,
    portfolio: 0,
    unclassified: 0,
  };
  for (const category of categories) byKind[category.kind] += last12(category);

  const sources = categories
    .map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      kind: category.kind,
      last12Cents: last12(category),
      share: total12 > 0 ? oneDecimal((last12(category) / total12) * 100) : 0,
      monthsPaid: category.monthlyCents.slice(-6).filter((cents) => cents > 0)
        .length,
    }))
    .filter((source) => source.last12Cents > 0)
    .sort((a, b) => b.last12Cents - a.last12Cents);

  const largest = sources[0] ?? null;
  const passiveCents = byKind.passive + byKind.portfolio;

  return {
    last12Cents: total12,
    byKind,
    sources,
    activeSourceCount: sources.filter(
      (s) => s.monthsPaid >= ACTIVE_SOURCE_MONTHS,
    ).length,
    largestSource: largest,
    concentrated: largest !== null && largest.share > CONCENTRATION_SHARE * 100,
    /** Share of spending covered by passive and portfolio income, in percent. */
    passiveCoverage:
      trailingExpenseCents > 0
        ? oneDecimal((passiveCents / trailingExpenseCents) * 100)
        : null,
    /** Last 12 months vs the 12 before, in percent; null without a prior year. */
    yearOverYearGrowth:
      totalPrior12 > 0
        ? oneDecimal(((total12 - totalPrior12) / totalPrior12) * 100)
        : null,
  };
}
