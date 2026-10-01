/** Coefficient of variation above which monthly income counts as irregular. */
export const VARIABLE_INCOME_CV = 0.25;

/** Fewer months than this is not enough history to judge. */
export const MIN_MONTHS_FOR_STABILITY = 3;

export type IncomeStabilityAssessment = {
  stability: 'stable' | 'variable' | null;
  /** Standard deviation ÷ mean of monthly income; null without enough data. */
  coefficientOfVariation: number | null;
  monthsConsidered: number;
};

/**
 * Classifies income as stable or variable from consecutive monthly totals
 * (oldest first, months without income included as 0). Leading months before
 * the first income are ignored so a new user's empty history does not read as
 * volatility.
 *
 * Variable income is the signal to hold a larger emergency fund
 * (6–12 months of essentials instead of 3–6).
 */
export function assessIncomeStability(
  monthlyIncomeCents: readonly number[],
): IncomeStabilityAssessment {
  const firstIncome = monthlyIncomeCents.findIndex((cents) => cents > 0);
  const months =
    firstIncome === -1 ? [] : monthlyIncomeCents.slice(firstIncome);

  if (months.length < MIN_MONTHS_FOR_STABILITY) {
    return {
      stability: null,
      coefficientOfVariation: null,
      monthsConsidered: months.length,
    };
  }

  const mean = months.reduce((sum, cents) => sum + cents, 0) / months.length;
  const variance =
    months.reduce((sum, cents) => sum + (cents - mean) ** 2, 0) / months.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  return {
    stability:
      coefficientOfVariation > VARIABLE_INCOME_CV ? 'variable' : 'stable',
    coefficientOfVariation: Math.round(coefficientOfVariation * 1000) / 1000,
    monthsConsidered: months.length,
  };
}
