import {
  bandFor,
  interpolate,
  scoreHealth,
  type HealthInputs,
} from './health-score';

const healthy: HealthInputs = {
  hasHistory: true,
  trailing: {
    incomeCents: 3_000_000,
    expenseCents: 2_100_000, // 30% saved
    investingCents: 500_000, // 16.7%
    debtPaymentCents: 0,
    debtInterestCents: 0,
    housingCents: 750_000, // 25%
    fixedCents: 1_200_000, // 40%
  },
  emergency: {
    balanceCents: 1_800_000,
    averageEssentialCents: 500_000,
    targetMonths: 3,
  },
  highInterestDebtCents: 0,
  netWorthMonthEnds: [0, 100_000, 200_000, 300_000, 400_000, 500_000, 600_000],
  averageMonthlyIncomeCents: 1_000_000,
  protection: {
    hasHealthInsurance: true,
    hasLifeInsurance: null,
    dependents: 0,
  },
};

const metric = (result: ReturnType<typeof scoreHealth>, key: string) =>
  result.metrics.find((m) => m.key === key)!;

describe('interpolate', () => {
  it('scores rising and falling scales and clamps', () => {
    expect(interpolate(10, 0, 20)).toBe(50);
    expect(interpolate(40, 0, 20)).toBe(100);
    expect(interpolate(-5, 0, 20)).toBe(0);
    expect(interpolate(32.5, 50, 15)).toBe(50);
  });
});

describe('bandFor', () => {
  it('maps scores to bands', () => {
    expect(bandFor(39)).toBe('building');
    expect(bandFor(40)).toBe('stable');
    expect(bandFor(70)).toBe('strong');
    expect(bandFor(85)).toBe('thriving');
  });
});

describe('scoreHealth', () => {
  it('scores a healthy household near the top', () => {
    const result = scoreHealth(healthy);
    expect(result.score).toBe(100);
    expect(result.band).toBe('thriving');
    expect(metric(result, 'savings_rate').value).toBe(30);
    expect(metric(result, 'emergency_cover').value).toBe(3.6);
  });

  it('excludes history metrics without three months of data and re-normalises', () => {
    const result = scoreHealth({ ...healthy, hasHistory: false });
    expect(metric(result, 'savings_rate').available).toBe(false);
    expect(metric(result, 'net_worth_trend').available).toBe(false);
    // Emergency cover, debt and insurance remain, all full marks.
    expect(result.score).toBe(100);
  });

  it('any high-interest debt scores that metric zero', () => {
    const result = scoreHealth({ ...healthy, highInterestDebtCents: 50_000 });
    expect(metric(result, 'high_interest_debt').score).toBe(0);
    expect(result.score).toBe(90);
  });

  it('needs life cover only with dependents', () => {
    const withKids = scoreHealth({
      ...healthy,
      protection: {
        hasHealthInsurance: true,
        hasLifeInsurance: false,
        dependents: 2,
      },
    });
    expect(metric(withKids, 'protection').score).toBe(50);

    const unanswered = scoreHealth({
      ...healthy,
      protection: {
        hasHealthInsurance: true,
        hasLifeInsurance: null,
        dependents: 2,
      },
    });
    expect(metric(unanswered, 'protection').available).toBe(false);
  });

  it('a falling net worth scores low', () => {
    const result = scoreHealth({
      ...healthy,
      netWorthMonthEnds: [
        600_000, 500_000, 400_000, 300_000, 200_000, 100_000, 0,
      ],
    });
    expect(metric(result, 'net_worth_trend').score).toBe(0);
  });

  it('keeps scoring the measures it can', () => {
    const result = scoreHealth({
      ...healthy,
      hasHistory: false,
      emergency: { ...healthy.emergency, averageEssentialCents: null },
      highInterestDebtCents: 0,
      protection: {
        hasHealthInsurance: null,
        hasLifeInsurance: null,
        dependents: null,
      },
    });
    // High-interest debt is always measurable.
    expect(result.score).toBe(100);
    expect(result.metrics.filter((m) => m.available)).toHaveLength(1);
  });
});
