/**
 * Financial independence maths, in today's money (real returns):
 *   FI number   = annual expenses / safe withdrawal rate
 *   FV          = P(1+r)^n + C·((1+r)^n − 1)/r   (monthly compounding)
 *   coast FI    = FI number / (1+r)^(years to retirement)
 */

/** Annual rate (0.05) → equivalent monthly rate. */
export const monthlyRate = (annual: number) => (1 + annual) ** (1 / 12) - 1;

export function fiNumber(annualExpenseCents: number, safeWithdrawalRate: number) {
  return safeWithdrawalRate > 0 ? Math.round(annualExpenseCents / safeWithdrawalRate) : Infinity;
}

/** Value after `months` with a starting amount and a monthly contribution. */
export function futureValue(startCents: number, monthlyCents: number, annualReturn: number, months: number) {
  const r = monthlyRate(annualReturn);
  if (r === 0) return startCents + monthlyCents * months;
  const growth = (1 + r) ** months;
  return startCents * growth + (monthlyCents * (growth - 1)) / r;
}

/** Months until `targetCents` is reached; 0 if already there, null if never (within 100 years). */
export function monthsToTarget(startCents: number, monthlyCents: number, annualReturn: number, targetCents: number) {
  if (startCents >= targetCents) return 0;
  if (monthlyCents <= 0 && (startCents <= 0 || annualReturn <= 0)) return null;
  const r = monthlyRate(annualReturn);
  let value = startCents;
  for (let month = 1; month <= 1200; month += 1) {
    value = value * (1 + r) + monthlyCents;
    if (value >= targetCents) return month;
  }
  return null;
}

/** What needs to be invested today to reach `fiNumberCents` by retirement with no more contributions. */
export function coastFiNumber(fiNumberCents: number, annualReturn: number, yearsToRetirement: number) {
  return Math.round(fiNumberCents / (1 + annualReturn) ** Math.max(0, yearsToRetirement));
}

export const SENSITIVITY_RETURNS = [0.03, 0.05, 0.07] as const;
export const SENSITIVITY_SAVINGS_RATES = [0.1, 0.2, 0.3, 0.5] as const;

/**
 * Years to FI for each savings rate × return, assuming spending is what is
 * not saved. It shows why the savings rate matters more than the return.
 */
export function sensitivityTable(monthlyIncomeCents: number, investedCents: number, safeWithdrawalRate: number) {
  return SENSITIVITY_SAVINGS_RATES.map((savingsRate) => {
    const monthlySaving = monthlyIncomeCents * savingsRate;
    const target = fiNumber(monthlyIncomeCents * (1 - savingsRate) * 12, safeWithdrawalRate);
    return {
      savingsRate,
      years: SENSITIVITY_RETURNS.map((annualReturn) => {
        const months = monthsToTarget(investedCents, monthlySaving, annualReturn, target);
        return months === null ? null : Math.round((months / 12) * 10) / 10;
      }),
    };
  });
}
