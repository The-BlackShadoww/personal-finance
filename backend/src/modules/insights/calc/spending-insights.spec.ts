import {
  detectDrift,
  detectLifestyleCreep,
  detectSubscriptions,
  detectUnusual,
  median,
  rankInsights,
  type ExpenseSample,
} from './spending-insights';

const sample = (
  overrides: Partial<ExpenseSample> &
    Pick<ExpenseSample, 'id' | 'amountCents' | 'date'>,
): ExpenseSample => ({
  categoryId: 'food',
  categoryName: 'Groceries',
  note: null,
  recurring: false,
  ...overrides,
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('detectDrift', () => {
  const dining = {
    categoryId: 'd',
    name: 'Dining out',
    previousCents: [40_000, 40_000, 40_000] as [number, number, number],
  };

  it('flags a category well over its average when the excess matters', () => {
    const [insight] = detectDrift(
      [{ ...dining, currentCents: 100_000 }],
      1_000_000,
    );
    expect(insight).toMatchObject({
      kind: 'category_drift',
      amountCents: 60_000,
    });
  });

  it('ignores small excesses relative to income', () => {
    expect(
      detectDrift([{ ...dining, currentCents: 60_000 }], 1_000_000),
    ).toEqual([]);
  });

  it('ignores categories with no history', () => {
    expect(
      detectDrift(
        [{ ...dining, previousCents: [0, 0, 0], currentCents: 900_000 }],
        1_000_000,
      ),
    ).toEqual([]);
  });
});

describe('detectUnusual', () => {
  const history = [10_000, 11_000, 9_000, 10_500, 9_500, 10_000].map(
    (amountCents, i) =>
      sample({ id: `h${i}`, amountCents, date: `2026-0${i + 1}-05` }),
  );

  it('flags an expense far above the category median', () => {
    const big = sample({
      id: 'big',
      amountCents: 40_000,
      date: '2026-09-20',
      note: 'Party',
    });
    const [insight] = detectUnusual([...history, big], '2026-09-01');
    expect(insight).toMatchObject({
      kind: 'unusual_transaction',
      transactionId: 'big',
      amountCents: 30_000,
    });
  });

  it('needs six other expenses to compare against', () => {
    const big = sample({ id: 'big', amountCents: 40_000, date: '2026-09-20' });
    expect(detectUnusual([...history.slice(0, 5), big], '2026-09-01')).toEqual(
      [],
    );
  });

  it('only looks at recent expenses', () => {
    const big = sample({ id: 'big', amountCents: 40_000, date: '2026-07-20' });
    expect(detectUnusual([...history, big], '2026-09-01')).toEqual([]);
  });
});

describe('detectSubscriptions', () => {
  const charges = ['2026-06-03', '2026-07-03', '2026-08-04', '2026-09-03'].map(
    (date, i) =>
      sample({
        id: `s${i}`,
        categoryId: 'subs',
        categoryName: 'Subscriptions',
        amountCents: 1_500 + (i % 2) * 20,
        date,
        note: 'Music',
      }),
  );

  it('finds monthly charges of about the same amount', () => {
    const [insight] = detectSubscriptions(charges, [], '2026-09-20');
    expect(insight).toMatchObject({
      kind: 'subscription',
      title: 'Music looks like a subscription',
      amountCents: 18_240,
    });
  });

  it('skips ones already tracked as a rule', () => {
    expect(
      detectSubscriptions(
        charges,
        [{ categoryId: 'subs', amountCents: 1_510 }],
        '2026-09-20',
      ),
    ).toEqual([]);
  });

  it('skips ones that stopped', () => {
    expect(detectSubscriptions(charges, [], '2026-12-01')).toEqual([]);
  });

  it('ignores other expenses in between', () => {
    const noise = sample({
      id: 'n',
      categoryId: 'subs',
      categoryName: 'Subscriptions',
      amountCents: 9_900,
      date: '2026-07-15',
    });
    expect(
      detectSubscriptions([...charges, noise], [], '2026-09-20'),
    ).toHaveLength(1);
  });
});

describe('detectLifestyleCreep', () => {
  it('flags spending that absorbs most of a raise', () => {
    const income = [100, 100, 100, 120, 120, 120].map((v) => v * 1000);
    const expense = [80, 80, 80, 95, 95, 95].map((v) => v * 1000);
    const [insight] = detectLifestyleCreep(income, expense);
    expect(insight.kind).toBe('lifestyle_creep');
    expect(insight.detail).toContain('75%');
  });

  it('stays quiet when most of the raise is saved', () => {
    const income = [100, 100, 100, 120, 120, 120].map((v) => v * 1000);
    const expense = [80, 80, 80, 85, 85, 85].map((v) => v * 1000);
    expect(detectLifestyleCreep(income, expense)).toEqual([]);
  });
});

describe('rankInsights', () => {
  it('keeps the top three, creep first', () => {
    const make = (
      kind: 'category_drift' | 'lifestyle_creep',
      amountCents: number,
    ) => ({
      kind,
      title: '',
      detail: '',
      amountCents,
      categoryId: null,
      transactionId: null,
      href: '',
    });
    const ranked = rankInsights([
      make('category_drift', 5),
      make('category_drift', 50),
      make('lifestyle_creep', 1),
      make('category_drift', 20),
    ]);
    expect(ranked.map((i) => i.amountCents)).toEqual([1, 50, 20]);
  });
});
