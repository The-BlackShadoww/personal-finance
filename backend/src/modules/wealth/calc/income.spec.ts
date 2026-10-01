import { incomeSummary, type CategoryIncome } from './income';

const months = (prior: number, recent: number) => [
  ...Array<number>(12).fill(prior),
  ...Array<number>(12).fill(recent),
];

const salary: CategoryIncome = {
  categoryId: 's',
  name: 'Salary',
  kind: 'active',
  monthlyCents: months(100_000, 110_000),
};
const dividends: CategoryIncome = {
  categoryId: 'd',
  name: 'Dividends',
  kind: 'portfolio',
  monthlyCents: months(0, 5_000),
};

describe('incomeSummary', () => {
  it('groups by kind and measures growth and coverage', () => {
    const result = incomeSummary([salary, dividends], 900_000);
    expect(result.byKind).toMatchObject({
      active: 1_320_000,
      portfolio: 60_000,
    });
    expect(result.passiveCoverage).toBeCloseTo(6.7);
    expect(result.yearOverYearGrowth).toBe(15);
    expect(result.activeSourceCount).toBe(2);
  });

  it('flags a single dominant source', () => {
    const result = incomeSummary([salary, dividends], 900_000);
    expect(result.largestSource?.name).toBe('Salary');
    expect(result.concentrated).toBe(true);
  });

  it('needs a prior year for growth and spending for coverage', () => {
    const fresh = {
      ...salary,
      monthlyCents: [
        ...Array<number>(18).fill(0),
        ...Array<number>(6).fill(100),
      ],
    };
    const result = incomeSummary([fresh], 0);
    expect(result.yearOverYearGrowth).toBeNull();
    expect(result.passiveCoverage).toBeNull();
  });

  it('ignores sources with nothing in the last year', () => {
    const old = { ...salary, monthlyCents: months(100, 0) };
    expect(incomeSummary([old], 1).sources).toEqual([]);
  });
});
