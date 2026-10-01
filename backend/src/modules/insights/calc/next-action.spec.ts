import { nextBestAction, suggestPace, type ActionInputs } from './next-action';

const base: ActionInputs = {
  availableCents: 100_000,
  hasHistory: true,
  averageMonthlyIncomeCents: 1_000_000,
  averageMonthlySurplusCents: 200_000,
  emergency: {
    balanceCents: 1_500_000,
    averageEssentialCents: 500_000,
    targetMonths: 3,
  },
  employerMatchPercent: null,
  investingMonthlyCents: 150_000,
  highInterestDebts: [],
  sinkingBehind: [],
  protection: {
    hasHealthInsurance: true,
    hasLifeInsurance: null,
    dependents: 0,
  },
};

describe('suggestPace', () => {
  it('uses the surplus, else a tenth of income', () => {
    expect(suggestPace(600_000, 200_000, 1_000_000)).toEqual({
      monthlyCents: 200_000,
      months: 3,
    });
    expect(suggestPace(600_000, -50_000, 1_000_000)).toEqual({
      monthlyCents: 100_000,
      months: 6,
    });
    expect(suggestPace(50_000, 200_000, 1_000_000)).toEqual({
      monthlyCents: 50_000,
      months: 1,
    });
    expect(suggestPace(600_000, null, null)).toEqual({
      monthlyCents: null,
      months: null,
    });
  });
});

describe('nextBestAction', () => {
  it('is on track when every step is met', () => {
    expect(nextBestAction(base).key).toBe('on_track');
  });

  it('covers an overspend before anything else', () => {
    const result = nextBestAction({
      ...base,
      availableCents: -25_000,
      hasHistory: false,
    });
    expect(result).toMatchObject({
      key: 'cover_overspend',
      amountCents: 25_000,
    });
  });

  it('asks for history first', () => {
    expect(nextBestAction({ ...base, hasHistory: false }).key).toBe(
      'start_tracking',
    );
  });

  it('builds the starter buffer before the employer match and debt', () => {
    const result = nextBestAction({
      ...base,
      emergency: { ...base.emergency, balanceCents: 100_000 },
      employerMatchPercent: 5,
      highInterestDebts: [
        { accountId: 'c', name: 'Card', balanceCents: 300_000, aprBps: 2400 },
      ],
    });
    expect(result).toMatchObject({
      key: 'starter_buffer',
      step: 'W1',
      amountCents: 400_000,
      monthlyCents: 200_000,
      months: 2,
    });
  });

  it('captures the match before paying down debt', () => {
    const result = nextBestAction({
      ...base,
      employerMatchPercent: 20,
      highInterestDebts: [
        { accountId: 'c', name: 'Card', balanceCents: 300_000, aprBps: 2400 },
      ],
    });
    expect(result).toMatchObject({
      key: 'employer_match',
      monthlyCents: 50_000,
    });
  });

  it('targets the first (highest-rate) debt', () => {
    const result = nextBestAction({
      ...base,
      highInterestDebts: [
        { accountId: 'c', name: 'Card', balanceCents: 300_000, aprBps: 2400 },
      ],
    });
    expect(result.key).toBe('high_interest_debt');
    expect(result.title).toContain('Card');
    expect(result.detail).toContain('24.0% APR');
  });

  it('finishes the emergency fund, then raises investing', () => {
    expect(
      nextBestAction({
        ...base,
        emergency: { ...base.emergency, balanceCents: 900_000 },
      }),
    ).toMatchObject({ key: 'emergency_fund', amountCents: 600_000 });
    expect(
      nextBestAction({ ...base, investingMonthlyCents: 50_000 }),
    ).toMatchObject({
      key: 'invest_more',
      monthlyCents: 100_000,
    });
  });

  it('then sinking funds, then protection', () => {
    expect(
      nextBestAction({
        ...base,
        sinkingBehind: [
          {
            goalId: 'g',
            name: 'Laptop',
            shortfallMonthlyCents: 20_000,
            targetDate: '2027-01-01',
          },
        ],
      }).key,
    ).toBe('sinking_fund');
    expect(
      nextBestAction({
        ...base,
        protection: {
          hasHealthInsurance: false,
          hasLifeInsurance: null,
          dependents: 0,
        },
      }).key,
    ).toBe('protection');
  });
});
