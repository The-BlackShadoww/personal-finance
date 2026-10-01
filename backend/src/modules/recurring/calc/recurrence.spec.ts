import {
  billingPeriod,
  monthlyEquivalent,
  nextOccurrenceAfter,
  occurrenceAt,
  occurrencesBetween,
} from './recurrence';

describe('occurrenceAt', () => {
  it('clamps month-end anchors and returns to the anchor day', () => {
    expect(
      [0, 1, 2, 3].map((n) => occurrenceAt('2026-01-31', 'monthly', n)),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('handles leap years for yearly rules', () => {
    expect(occurrenceAt('2024-02-29', 'yearly', 1)).toBe('2025-02-28');
    expect(occurrenceAt('2024-02-29', 'yearly', 4)).toBe('2028-02-29');
  });

  it('steps weeks across month and year ends', () => {
    expect(occurrenceAt('2026-12-25', 'weekly', 1)).toBe('2027-01-01');
    expect(occurrenceAt('2026-12-25', 'biweekly', 2)).toBe('2027-01-22');
  });

  it('steps quarters', () => {
    expect(occurrenceAt('2026-11-30', 'quarterly', 1)).toBe('2027-02-28');
  });
});

describe('occurrencesBetween', () => {
  const salary = {
    anchorDate: '2026-01-25',
    frequency: 'monthly' as const,
    endDate: null,
  };

  it('lists due occurrences in range, inclusive', () => {
    expect(occurrencesBetween(salary, '2026-03-25', '2026-05-25')).toEqual([
      '2026-03-25',
      '2026-04-25',
      '2026-05-25',
    ]);
  });

  it('stops at the end date', () => {
    expect(
      occurrencesBetween(
        { ...salary, endDate: '2026-04-01' },
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-25', '2026-02-25', '2026-03-25']);
  });

  it('is empty before the anchor', () => {
    expect(occurrencesBetween(salary, '2025-01-01', '2025-12-31')).toEqual([]);
  });
});

describe('nextOccurrenceAfter', () => {
  const rule = {
    anchorDate: '2026-01-31',
    frequency: 'monthly' as const,
    endDate: '2026-03-31',
  };
  it('finds the next date and ends with the rule', () => {
    expect(nextOccurrenceAfter(rule, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrenceAfter(rule, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrenceAfter(rule, '2026-03-31')).toBeNull();
  });
});

describe('monthlyEquivalent', () => {
  it('normalises to a month', () => {
    expect(monthlyEquivalent(1200, 'weekly')).toBe(5200);
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100);
    expect(monthlyEquivalent(1200, 'quarterly')).toBe(400);
  });
});

describe('billingPeriod', () => {
  it('shifts across years', () => {
    expect(billingPeriod('2026-01-01', -1)).toEqual({ year: 2025, month: 12 });
    expect(billingPeriod('2026-12-28', 1)).toEqual({ year: 2027, month: 1 });
    expect(billingPeriod('2026-06-15', 0)).toEqual({ year: 2026, month: 6 });
  });
});
