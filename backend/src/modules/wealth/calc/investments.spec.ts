import {
  allocation,
  contributionMonths,
  feeDrag,
  modifiedDietz,
  rebalanceAdvice,
} from './investments';

describe('modifiedDietz', () => {
  it('is the simple return without flows', () => {
    expect(
      modifiedDietz(100_000, 110_000, [], '2025-10-01', '2026-10-01'),
    ).toBeCloseTo(0.1);
  });

  it('does not count contributions as gains', () => {
    // 1,000 in at the start, 500 more half-way, worth 1,600 at the end.
    const result = modifiedDietz(
      100_000,
      160_000,
      [{ day: '2026-04-02', amountCents: 50_000 }],
      '2025-10-01',
      '2026-10-01',
    );
    expect(result).toBeCloseTo(10_000 / (100_000 + 50_000 * 0.4986), 3);
  });

  it('ignores flows outside the window and needs a base', () => {
    expect(
      modifiedDietz(
        0,
        0,
        [{ day: '2024-01-01', amountCents: 5 }],
        '2025-10-01',
        '2026-10-01',
      ),
    ).toBeNull();
  });
});

describe('allocation', () => {
  const holdings = [
    { assetClass: 'equity' as const, valueCents: 70_000 },
    { assetClass: 'bond' as const, valueCents: 30_000 },
  ];

  it('reports shares without a target', () => {
    const result = allocation(holdings, new Map());
    expect(
      result.rows.map((r) => [r.assetClass, r.percent, r.driftPoints]),
    ).toEqual([
      ['equity', 70, null],
      ['bond', 30, null],
    ]);
    expect(result.advice).toBe('none');
  });

  it('measures drift from the target, including missing classes', () => {
    const result = allocation(
      holdings,
      new Map([
        ['equity', 5000],
        ['bond', 4000],
        ['cash', 1000],
      ]),
    );
    expect(result.rows.find((r) => r.assetClass === 'cash')).toMatchObject({
      percent: 0,
      driftPoints: -10,
    });
    expect(result.maxDriftPoints).toBe(20);
    expect(result.advice).toBe('now');
  });
});

describe('rebalanceAdvice', () => {
  it('waits for the yearly review between 5 and 10 points', () => {
    expect(rebalanceAdvice(4)).toBe('none');
    expect(rebalanceAdvice(7)).toBe('at_yearly_review');
    expect(rebalanceAdvice(11)).toBe('now');
  });
});

describe('feeDrag', () => {
  it('costs more the higher the fee', () => {
    const drag = feeDrag(1_000_000, 150, 700);
    // 10,000 at 6.8% vs 5.5% for 20 years.
    expect(drag).toBe(Math.round(1_000_000 * (1.068 ** 20 - 1.055 ** 20)));
    expect(feeDrag(1_000_000, 20, 700)).toBe(0);
  });
});

describe('contributionMonths', () => {
  it('counts months with money in', () => {
    expect(contributionMonths([0, 5, 0, 10])).toBe(2);
  });
});
