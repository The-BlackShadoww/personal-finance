import {
  bookBalanceAt,
  currentValue,
  monthEnd,
  netWorthSeries,
  slope,
  valueAt,
  type ValuedAccount,
} from './net-worth';

const brokerage: ValuedAccount = {
  nature: 'asset',
  // Two contributions of 1,000 → book 2,000.
  currentBookCents: 200_000,
  flows: [
    { day: '2026-01-10', flowCents: 100_000 },
    { day: '2026-03-10', flowCents: 100_000 },
  ],
  valuations: [{ date: '2026-02-28', valueCents: 120_000 }],
};

const card: ValuedAccount = {
  nature: 'liability',
  // Spent 500 in January, paid 300 in February → owes 200.
  currentBookCents: 20_000,
  flows: [
    { day: '2026-01-15', flowCents: -50_000 },
    { day: '2026-02-15', flowCents: 30_000 },
  ],
  valuations: [],
};

describe('monthEnd', () => {
  it('handles short months and leap years', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    expect(monthEnd('2026-12')).toBe('2026-12-31');
  });
});

describe('bookBalanceAt', () => {
  it('walks back from the current balance', () => {
    expect(bookBalanceAt(brokerage, '2026-01-31')).toBe(100_000);
    expect(bookBalanceAt(brokerage, '2025-12-31')).toBe(0);
  });

  it('flips the sign for liabilities', () => {
    expect(bookBalanceAt(card, '2026-01-31')).toBe(50_000);
    expect(bookBalanceAt(card, '2025-12-31')).toBe(0);
  });
});

describe('valueAt', () => {
  it('uses the book balance before the first valuation', () => {
    expect(valueAt(brokerage, '2026-01-31')).toBe(100_000);
  });

  it('uses the valuation on its date', () => {
    expect(valueAt(brokerage, '2026-02-28')).toBe(120_000);
  });

  it('adds money moved in after the valuation', () => {
    expect(valueAt(brokerage, '2026-03-31')).toBe(220_000);
    expect(currentValue(brokerage)).toBe(220_000);
  });

  it('ignores valuations for liabilities', () => {
    expect(
      currentValue({
        ...card,
        valuations: [{ date: '2026-01-01', valueCents: 1 }],
      }),
    ).toBe(20_000);
  });
});

describe('netWorthSeries', () => {
  it('nets assets against liabilities at each month-end', () => {
    const series = netWorthSeries(
      [brokerage, card],
      ['2026-01', '2026-02', '2026-03'],
    );
    expect(series.map((p) => p.netWorthCents)).toEqual([
      50_000, 100_000, 200_000,
    ]);
    expect(series[2]).toMatchObject({
      assetsCents: 220_000,
      liabilitiesCents: 20_000,
    });
  });

  it('a transfer between two accounts never changes net worth', () => {
    const bank: ValuedAccount = {
      nature: 'asset',
      currentBookCents: 400_000,
      flows: [{ day: '2026-02-01', flowCents: -100_000 }],
      valuations: [],
    };
    const savings: ValuedAccount = {
      nature: 'asset',
      currentBookCents: 100_000,
      flows: [{ day: '2026-02-01', flowCents: 100_000 }],
      valuations: [],
    };
    const series = netWorthSeries([bank, savings], ['2026-01', '2026-02']);
    expect(series[0].netWorthCents).toBe(series[1].netWorthCents);
  });
});

describe('slope', () => {
  it('fits a line through evenly spaced values', () => {
    expect(slope([0, 10, 20, 30])).toBeCloseTo(10);
    expect(slope([5, 5, 5])).toBe(0);
    expect(slope([1])).toBeNull();
  });
});
