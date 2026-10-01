const oneDecimal = (value: number) => Math.round(value * 10) / 10;

export type Runway = {
  liquidCents: number;
  averageExpenseCents: number | null;
  averageEssentialCents: number | null;
  /** Months liquid money lasts at the current lifestyle. */
  fullMonths: number | null;
  /** Months it lasts on essentials only. */
  essentialMonths: number | null;
};

/** "Months of freedom": how long liquid money would last without income. */
export function runway(
  liquidCents: number,
  averageExpenseCents: number | null,
  averageEssentialCents: number | null,
): Runway {
  const months = (average: number | null) =>
    average && average > 0
      ? oneDecimal(Math.max(0, liquidCents) / average)
      : null;
  return {
    liquidCents,
    averageExpenseCents,
    averageEssentialCents,
    fullMonths: months(averageExpenseCents),
    essentialMonths: months(averageEssentialCents),
  };
}
