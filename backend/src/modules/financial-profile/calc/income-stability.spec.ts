import { assessIncomeStability } from './income-stability';

describe('assessIncomeStability', () => {
  it('needs at least three months of history', () => {
    expect(assessIncomeStability([0, 0, 0, 0, 5000, 5000])).toEqual({
      stability: null,
      coefficientOfVariation: null,
      monthsConsidered: 2,
    });
  });

  it('returns null when there is no income at all', () => {
    expect(assessIncomeStability([0, 0, 0]).stability).toBeNull();
  });

  it('treats a steady salary as stable', () => {
    const result = assessIncomeStability([
      80000, 80000, 82000, 80000, 80000, 81000,
    ]);
    expect(result.stability).toBe('stable');
    expect(result.coefficientOfVariation).toBeLessThan(0.05);
  });

  it('treats swinging freelance income as variable', () => {
    const result = assessIncomeStability([
      20000, 90000, 45000, 120000, 30000, 70000,
    ]);
    expect(result.stability).toBe('variable');
    expect(result.coefficientOfVariation).toBeGreaterThan(0.25);
  });

  it('counts months with no income after the first paycheck as volatility', () => {
    expect(assessIncomeStability([50000, 0, 50000, 50000]).stability).toBe(
      'variable',
    );
  });

  it('ignores empty months before the first income', () => {
    const result = assessIncomeStability([0, 0, 60000, 60000, 60000]);
    expect(result).toEqual({
      stability: 'stable',
      coefficientOfVariation: 0,
      monthsConsidered: 3,
    });
  });
});
