import { transferPurpose } from '../account-kinds';
import {
  balanceTrend,
  naturalBalance,
  netWorthContribution,
  trailingMonths,
} from './balances';

describe('naturalBalance', () => {
  it('adds net inflow to an asset', () => {
    // Opening 1,000; salary +500; groceries −200.
    expect(naturalBalance('asset', 100000, 50000 - 20000)).toBe(130000);
  });

  it('treats spending on a liability as more owed and payments as less', () => {
    // Card owes 300; spend 200 on it (outflow); pay 100 into it (inflow).
    expect(naturalBalance('liability', 30000, -20000 + 10000)).toBe(40000);
  });
});

describe('transfers', () => {
  it('leave net worth unchanged when moving money between assets', () => {
    const before =
      netWorthContribution('asset', naturalBalance('asset', 50000, 0)) +
      netWorthContribution('asset', naturalBalance('asset', 0, 0));
    // Move 200 from bank (−) to savings (+).
    const after =
      netWorthContribution('asset', naturalBalance('asset', 50000, -20000)) +
      netWorthContribution('asset', naturalBalance('asset', 0, 20000));
    expect(after).toBe(before);
  });

  it('leave net worth unchanged when paying down a card', () => {
    const before =
      netWorthContribution('asset', naturalBalance('asset', 50000, 0)) +
      netWorthContribution('liability', naturalBalance('liability', 30000, 0));
    const after =
      netWorthContribution('asset', naturalBalance('asset', 50000, -30000)) +
      netWorthContribution(
        'liability',
        naturalBalance('liability', 30000, 30000),
      );
    expect(after).toBe(before);
    expect(naturalBalance('liability', 30000, 30000)).toBe(0);
  });
});

describe('transferPurpose', () => {
  const bank = { kind: 'bank' as const, nature: 'asset' as const };
  it('classifies where surplus went', () => {
    expect(transferPurpose(bank, { kind: 'savings', nature: 'asset' })).toBe(
      'saving',
    );
    expect(transferPurpose(bank, { kind: 'investment', nature: 'asset' })).toBe(
      'investing',
    );
    expect(transferPurpose(bank, { kind: 'retirement', nature: 'asset' })).toBe(
      'investing',
    );
    expect(
      transferPurpose(bank, { kind: 'credit_card', nature: 'liability' }),
    ).toBe('debt');
    expect(transferPurpose(bank, { kind: 'cash', nature: 'asset' })).toBe(
      'other',
    );
  });

  it('does not count borrowing as a use of surplus', () => {
    expect(transferPurpose({ nature: 'liability' }, bank)).toBe('other');
  });
});

describe('trailingMonths', () => {
  it('crosses year boundaries', () => {
    expect(trailingMonths('2026-02', 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('balanceTrend', () => {
  const months = ['2026-07', '2026-08', '2026-09'];

  it('walks back from the current asset balance', () => {
    const trend = balanceTrend(
      'asset',
      150000,
      [
        { month: '2026-08', flowCents: 30000 },
        { month: '2026-09', flowCents: -10000 },
      ],
      months,
    );
    expect(trend).toEqual([
      { month: '2026-07', balanceCents: 130000 },
      { month: '2026-08', balanceCents: 160000 },
      { month: '2026-09', balanceCents: 150000 },
    ]);
  });

  it('flips direction for liabilities', () => {
    // Owe 400 now; in September spent 100 on the card (outflow −100).
    const trend = balanceTrend(
      'liability',
      40000,
      [{ month: '2026-09', flowCents: -10000 }],
      months,
    );
    expect(trend.map((point) => point.balanceCents)).toEqual([
      30000, 30000, 40000,
    ]);
  });
});
