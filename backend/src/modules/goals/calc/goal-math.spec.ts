import {
  allocateIncome,
  averageMonthlyEssential,
  defaultEmergencyMonths,
  effectiveTargetDate,
  goalProgress,
  monthsToSave,
  remainingToTarget,
  type FundableGoal,
} from './goal-math';

const goal = (
  overrides: Partial<FundableGoal> & { id: string },
): FundableGoal => ({
  fundingRule: 'manual',
  fundingPercentBps: null,
  fundingAmountCents: null,
  remainingToTargetCents: null,
  autoThisPeriodCents: 0,
  ...overrides,
});

describe('allocateIncome', () => {
  it('takes percent shares in priority order', () => {
    expect(
      allocateIncome(8000000, [
        goal({
          id: 'emergency',
          fundingRule: 'percent_of_income',
          fundingPercentBps: 1000,
        }),
        goal({
          id: 'laptop',
          fundingRule: 'percent_of_income',
          fundingPercentBps: 500,
        }),
        goal({ id: 'manual' }),
      ]),
    ).toEqual([
      { goalId: 'emergency', amountCents: 800000 },
      { goalId: 'laptop', amountCents: 400000 },
    ]);
  });

  it('never fills a goal past its target', () => {
    expect(
      allocateIncome(100000, [
        goal({
          id: 'almost',
          fundingRule: 'percent_of_income',
          fundingPercentBps: 5000,
          remainingToTargetCents: 3000,
        }),
        goal({
          id: 'done',
          fundingRule: 'percent_of_income',
          fundingPercentBps: 5000,
          remainingToTargetCents: 0,
        }),
      ]),
    ).toEqual([{ goalId: 'almost', amountCents: 3000 }]);
  });

  it('tops fixed-monthly goals up to their monthly amount once per period', () => {
    const fixed = goal({
      id: 'rent-fund',
      fundingRule: 'fixed_monthly',
      fundingAmountCents: 50000,
    });
    expect(allocateIncome(30000, [fixed])).toEqual([
      { goalId: 'rent-fund', amountCents: 30000 },
    ]);
    expect(
      allocateIncome(90000, [{ ...fixed, autoThisPeriodCents: 30000 }]),
    ).toEqual([{ goalId: 'rent-fund', amountCents: 20000 }]);
    expect(
      allocateIncome(90000, [{ ...fixed, autoThisPeriodCents: 50000 }]),
    ).toEqual([]);
  });

  it('never allocates more than the income', () => {
    const result = allocateIncome(10000, [
      goal({
        id: 'a',
        fundingRule: 'percent_of_income',
        fundingPercentBps: 8000,
      }),
      goal({
        id: 'b',
        fundingRule: 'percent_of_income',
        fundingPercentBps: 8000,
      }),
    ]);
    expect(result).toEqual([
      { goalId: 'a', amountCents: 8000 },
      { goalId: 'b', amountCents: 2000 },
    ]);
  });
});

describe('remainingToTarget', () => {
  const emergency = {
    kind: 'emergency',
    targetCents: 30000,
    balanceCents: 30000,
  };

  it('keeps the emergency fund taking its share of every income', () => {
    for (const balanceCents of [0, 29000, 30000, 500000]) {
      const remainingToTargetCents = remainingToTarget({
        ...emergency,
        balanceCents,
      });
      expect(remainingToTargetCents).toBeNull();
      expect(
        allocateIncome(100000, [
          goal({
            id: 'emergency',
            fundingRule: 'percent_of_income',
            fundingPercentBps: 1000,
            remainingToTargetCents,
          }),
        ]),
      ).toEqual([{ goalId: 'emergency', amountCents: 10000 }]);
    }
  });

  it('keeps a fixed-monthly emergency fund topped up, once per month', () => {
    const fixed = goal({
      id: 'emergency',
      fundingRule: 'fixed_monthly',
      fundingAmountCents: 150000,
      remainingToTargetCents: remainingToTarget(emergency),
    });
    expect(allocateIncome(500000, [fixed])).toEqual([
      { goalId: 'emergency', amountCents: 150000 },
    ]);
    expect(
      allocateIncome(500000, [{ ...fixed, autoThisPeriodCents: 150000 }]),
    ).toEqual([]);
  });

  it('still caps goals with a chosen target', () => {
    expect(remainingToTarget({ ...emergency, kind: 'sinking' })).toBe(0);
    expect(
      remainingToTarget({ ...emergency, kind: 'long_term', balanceCents: 10000 }),
    ).toBe(20000);
    expect(remainingToTarget({ ...emergency, kind: 'other', targetCents: null })).toBeNull();
  });
});

describe('averageMonthlyEssential', () => {
  it('ignores empty months before the first spending', () => {
    expect(averageMonthlyEssential([0, 0, 30000, 40000, 50000])).toBe(40000);
  });
  it('is null without data', () => {
    expect(averageMonthlyEssential([0, 0, 0])).toBeNull();
  });
});

describe('defaultEmergencyMonths', () => {
  it('doubles the cushion for irregular income', () => {
    expect(defaultEmergencyMonths('variable')).toBe(6);
    expect(defaultEmergencyMonths('stable')).toBe(3);
    expect(defaultEmergencyMonths(null)).toBe(3);
  });
});

describe('effectiveTargetDate', () => {
  const today = { year: 2026, month: 10 };
  it('rolls yearly goals to the next occurrence', () => {
    expect(effectiveTargetDate('2025-03-15', true, today)).toBe('2027-03-15');
    expect(effectiveTargetDate('2026-10-01', true, today)).toBe('2026-10-01');
  });
  it('leaves one-off goals alone', () => {
    expect(effectiveTargetDate('2025-03-15', false, today)).toBe('2025-03-15');
  });
});

describe('monthsToSave', () => {
  it('counts this month and the target month', () => {
    expect(monthsToSave({ year: 2026, month: 10 }, '2026-12-20')).toBe(3);
    expect(monthsToSave({ year: 2026, month: 10 }, '2026-01-01')).toBe(1);
  });
});

describe('goalProgress', () => {
  const today = { year: 2026, month: 10 };

  it('is open without a target', () => {
    expect(
      goalProgress({
        balanceCents: 500,
        targetCents: null,
        targetDate: null,
        paceMonthlyCents: 0,
        today,
      }).status,
    ).toBe('open');
  });

  it('is done at the target', () => {
    expect(
      goalProgress({
        balanceCents: 1000,
        targetCents: 1000,
        targetDate: '2027-01-01',
        paceMonthlyCents: 0,
        today,
      }),
    ).toEqual({
      percent: 100,
      requiredMonthlyCents: 0,
      projectedCompletion: null,
      status: 'done',
    });
  });

  it('compares the pace with what the date requires', () => {
    // 1,200 left over Oct–Dec → 400/month needed.
    const base = {
      balanceCents: 0,
      targetCents: 120000,
      targetDate: '2026-12-31',
      today,
    };
    expect(goalProgress({ ...base, paceMonthlyCents: 30000 }).status).toBe(
      'behind',
    );
    expect(goalProgress({ ...base, paceMonthlyCents: 40000 }).status).toBe(
      'on_track',
    );
    expect(goalProgress({ ...base, paceMonthlyCents: 50000 })).toEqual({
      percent: 0,
      requiredMonthlyCents: 40000,
      projectedCompletion: '2026-12',
      status: 'ahead',
    });
  });

  it('projects completion without a date', () => {
    expect(
      goalProgress({
        balanceCents: 0,
        targetCents: 100000,
        targetDate: null,
        paceMonthlyCents: 30000,
        today,
      }),
    ).toMatchObject({
      status: 'open',
      projectedCompletion: '2027-01',
    });
  });
});
