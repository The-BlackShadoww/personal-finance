import {
  buildLeaks,
  buildWins,
  repeatedNo,
  worthItCandidates,
  type ReviewCategory,
  type ReviewInputs,
} from './review';

const money = (cents: number) => `$${cents / 100}`;

const category = (
  overrides: Partial<ReviewCategory> &
    Pick<ReviewCategory, 'categoryId' | 'name'>,
): ReviewCategory => ({
  essential: false,
  availableCents: null,
  spentCents: 0,
  averageCents: 0,
  ...overrides,
});

const base: ReviewInputs = {
  incomeCents: 1_000_000,
  expenseCents: 700_000,
  netWorthChangeCents: 250_000,
  categories: [],
  goalContributionCents: 100_000,
  investedCents: 0,
  debtRepaidCents: 0,
  newSubscriptions: [],
  creep: null,
};

describe('buildWins', () => {
  it('keeps the three largest wins', () => {
    const wins = buildWins(
      {
        ...base,
        categories: [
          category({
            categoryId: 'g',
            name: 'Groceries',
            availableCents: 80_000,
            spentCents: 60_000,
          }),
        ],
      },
      money,
    );
    expect(wins.map((w) => w.kind)).toEqual([
      'savings_rate',
      'net_worth',
      'goals',
    ]);
    expect(wins[0].title).toBe('Kept 30% of your income');
  });

  it('skips a savings rate under 20%', () => {
    const wins = buildWins({ ...base, expenseCents: 900_000 }, money);
    expect(wins.some((w) => w.kind === 'savings_rate')).toBe(false);
  });
});

describe('buildLeaks', () => {
  it('reports overspends and drift, not both for one category', () => {
    const leaks = buildLeaks(
      {
        ...base,
        categories: [
          category({
            categoryId: 'd',
            name: 'Dining',
            availableCents: 50_000,
            spentCents: 90_000,
            averageCents: 40_000,
          }),
          category({
            categoryId: 's',
            name: 'Shopping',
            spentCents: 200_000,
            averageCents: 100_000,
          }),
        ],
      },
      money,
    );
    expect(leaks.map((l) => [l.kind, l.amountCents])).toEqual([
      ['category_drift', 100_000],
      ['over_budget', 40_000],
    ]);
    expect(leaks[1].detail).toContain('Move money');
  });

  it('puts lifestyle creep first and annualises new subscriptions', () => {
    const leaks = buildLeaks(
      {
        ...base,
        newSubscriptions: [{ name: 'Video', monthlyCents: 1_500 }],
        creep: { title: 'Creep', detail: '', amountCents: 1 },
      },
      money,
    );
    expect(leaks.map((l) => l.kind)).toEqual([
      'lifestyle_creep',
      'new_subscription',
    ]);
    expect(leaks[1].amountCents).toBe(18_000);
  });
});

describe('worthItCandidates', () => {
  it('takes the five biggest discretionary categories', () => {
    const list = Array.from({ length: 7 }, (_v, i) =>
      category({
        categoryId: `c${i}`,
        name: `C${i}`,
        spentCents: (i + 1) * 100,
        essential: i === 6,
      }),
    );
    expect(worthItCandidates(list).map((c) => c.categoryId)).toEqual([
      'c5',
      'c4',
      'c3',
      'c2',
      'c1',
    ]);
  });
});

describe('repeatedNo', () => {
  it('flags categories rated no before', () => {
    expect(
      repeatedNo({ a: 'no', b: 'no', c: 'yes' }, [
        { a: 'no' },
        { b: 'meh', c: 'no' },
      ]),
    ).toEqual(['a']);
  });
});
