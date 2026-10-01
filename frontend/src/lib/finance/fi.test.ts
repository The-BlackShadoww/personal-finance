import { describe, expect, it } from "vitest";
import { coastFiNumber, fiNumber, futureValue, monthlyRate, monthsToTarget, sensitivityTable } from "./fi";

describe("fiNumber", () => {
  it("is annual spending divided by the withdrawal rate", () => {
    expect(fiNumber(4_000_000, 0.04)).toBe(100_000_000);
  });
});

describe("futureValue", () => {
  it("compounds monthly to the annual rate", () => {
    expect(futureValue(100_000, 0, 0.05, 12)).toBeCloseTo(105_000, 0);
    expect(monthlyRate(0.05)).toBeCloseTo(0.004074, 5);
  });

  it("adds contributions without growth at 0%", () => {
    expect(futureValue(1_000, 100, 0, 10)).toBe(2_000);
  });
});

describe("monthsToTarget", () => {
  it("counts months of contributions", () => {
    expect(monthsToTarget(0, 1_000, 0, 12_000)).toBe(12);
    expect(monthsToTarget(50_000, 0, 0.05, 40_000)).toBe(0);
  });

  it("is null when the target is out of reach", () => {
    expect(monthsToTarget(0, 0, 0.05, 1)).toBeNull();
  });
});

describe("coastFiNumber", () => {
  it("discounts the FI number by the years of growth left", () => {
    expect(coastFiNumber(100_000, 0.05, 10)).toBe(Math.round(100_000 / 1.05 ** 10));
  });
});

describe("sensitivityTable", () => {
  it("reaches FI sooner with a higher savings rate or return", () => {
    const rows = sensitivityTable(1_000_000, 0, 0.04);
    const years = (rate: number, column: number) => rows.find((r) => r.savingsRate === rate)!.years[column]!;
    expect(years(0.5, 1)).toBeLessThan(years(0.1, 1));
    expect(years(0.2, 2)).toBeLessThan(years(0.2, 0));
    // The classic result: ~17 years at a 50% savings rate and 5% real.
    expect(years(0.5, 1)).toBeGreaterThan(15);
    expect(years(0.5, 1)).toBeLessThan(18);
  });
});
