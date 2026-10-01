import {
  availableWithRollover,
  budgetStatus,
  evaluatePlan,
  median,
} from './plan-math';

describe('availableWithRollover', () => {
  it('is just the budget without rollover', () => {
    expect(
      availableWithRollover([
        { amountCents: 10000, rollover: false, spentCents: 4000 },
        { amountCents: 10000, rollover: false, spentCents: 0 },
      ]),
    ).toEqual({ carryCents: 0, availableCents: 10000 });
  });

  it('carries leftovers forward month after month', () => {
    expect(
      availableWithRollover([
        { amountCents: 10000, rollover: true, spentCents: 7000 }, // +3000
        { amountCents: 10000, rollover: true, spentCents: 11000 }, // 13000 − 11000 = +2000
        { amountCents: 10000, rollover: true, spentCents: 0 },
      ]),
    ).toEqual({ carryCents: 2000, availableCents: 12000 });
  });

  it('carries overspending as a negative so it gets corrected', () => {
    expect(
      availableWithRollover([
        { amountCents: 10000, rollover: true, spentCents: 13000 },
        { amountCents: 10000, rollover: true, spentCents: 0 },
      ]),
    ).toEqual({ carryCents: -3000, availableCents: 7000 });
  });

  it('stops carrying when a month has no budget or rollover is off', () => {
    expect(
      availableWithRollover([
        { amountCents: 10000, rollover: true, spentCents: 0 },
        { amountCents: null, rollover: false, spentCents: 500 },
        { amountCents: 10000, rollover: true, spentCents: 0 },
      ]).carryCents,
    ).toBe(0);
    expect(
      availableWithRollover([
        { amountCents: 10000, rollover: false, spentCents: 0 },
        { amountCents: 10000, rollover: true, spentCents: 0 },
      ]).carryCents,
    ).toBe(0);
  });

  it('is null when the current month has no budget', () => {
    expect(
      availableWithRollover([
        { amountCents: null, rollover: false, spentCents: 900 },
      ]),
    ).toEqual({ carryCents: 0, availableCents: null });
  });
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 1000])).toBe(250);
    expect(median([])).toBe(0);
  });
});

describe('budgetStatus', () => {
  it('stays neutral until 80%', () => {
    expect(budgetStatus(7900, 10000)).toBe('ok');
    expect(budgetStatus(8000, 10000)).toBe('warning');
    expect(budgetStatus(10000, 10000)).toBe('warning');
    expect(budgetStatus(10001, 10000)).toBe('over');
  });
  it('handles missing and exhausted budgets', () => {
    expect(budgetStatus(500, null)).toBe('none');
    expect(budgetStatus(0, 0)).toBe('ok');
    expect(budgetStatus(1, 0)).toBe('over');
    expect(budgetStatus(0, -500)).toBe('over');
  });
});

describe('evaluatePlan', () => {
  const income = 8000000;

  it('checks 50/30/20 and computes what is left to assign', () => {
    const result = evaluatePlan({
      method: 'fifty_thirty_twenty',
      incomeCents: income,
      planned: { payFirst: 1600000, needs: 4200000, wants: 2000000 },
      actual: { payFirst: 800000, needs: 3000000, wants: 2500000 },
    });
    expect(result.leftToAssignCents).toBe(200000);
    expect(
      result.checks.map((c) => [
        c.bucket,
        c.targetCents,
        c.plannedOk,
        c.actualOk,
      ]),
    ).toEqual([
      ['payFirst', 1600000, true, true],
      ['needs', 4000000, false, true],
      ['wants', 2400000, true, false],
    ]);
  });

  it('combines needs and wants for 70/20/10', () => {
    const result = evaluatePlan({
      method: 'seventy_twenty_ten',
      incomeCents: income,
      planned: { payFirst: 1600000, needs: 4000000, wants: 1600000 },
      actual: { payFirst: 0, needs: 0, wants: 0 },
    });
    expect(result.checks.find((c) => c.bucket === 'living')).toMatchObject({
      targetCents: 5600000,
      plannedCents: 5600000,
      plannedOk: true,
    });
  });

  it('has no targets for zero-based, only what is left', () => {
    const result = evaluatePlan({
      method: 'zero_based',
      incomeCents: income,
      planned: { payFirst: 1000000, needs: 5000000, wants: 2000000 },
      actual: { payFirst: 0, needs: 0, wants: 0 },
    });
    expect(result).toEqual({ leftToAssignCents: 0, checks: [] });
  });
});
