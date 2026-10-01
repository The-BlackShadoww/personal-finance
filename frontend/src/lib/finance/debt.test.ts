import { describe, expect, it } from "vitest";
import { comparePayoff, payoffOrder, simulatePayoff, type Debt } from "./debt";

const card: Debt = { id: "card", name: "Card", balanceCents: 300_000, aprBps: 2400, minimumPaymentCents: 10_000 };
const loan: Debt = { id: "loan", name: "Loan", balanceCents: 100_000, aprBps: 800, minimumPaymentCents: 5_000 };

describe("payoffOrder", () => {
  it("avalanche targets the highest rate, snowball the smallest balance", () => {
    expect(payoffOrder([loan, card], "avalanche").map((d) => d.id)).toEqual(["card", "loan"]);
    expect(payoffOrder([card, loan], "snowball").map((d) => d.id)).toEqual(["loan", "card"]);
  });
});

describe("simulatePayoff", () => {
  it("pays a single interest-free debt in balance / payment months", () => {
    const result = simulatePayoff([{ ...loan, aprBps: 0 }], 0, "avalanche");
    expect(result.months).toBe(20);
    expect(result.totalInterestCents).toBe(0);
    expect(result.balances).toHaveLength(21);
  });

  it("charges monthly interest", () => {
    const result = simulatePayoff([{ ...loan, aprBps: 1200, minimumPaymentCents: 101_000 }], 0, "avalanche");
    // 1% for one month, then paid in full.
    expect(result).toMatchObject({ months: 1, totalInterestCents: 1_000, totalPaidCents: 101_000 });
  });

  it("puts the extra on the target debt and rolls minimums over", () => {
    const result = simulatePayoff([card, loan], 20_000, "avalanche");
    expect(result.firstMonthPayments).toEqual({ card: 30_000, loan: 5_000 });
    expect(result.payoffMonth.card).toBeLessThan(result.payoffMonth.loan as number);
  });

  it("flags minimums that do not cover interest and gives up at the cap", () => {
    const stuck: Debt = { ...card, minimumPaymentCents: 5_000 };
    const result = simulatePayoff([stuck], 0, "minimum");
    expect(result.negativeAmortization).toEqual(["card"]);
    expect(result.months).toBeNull();
  });

  it("assumes a 2% minimum when none is entered", () => {
    const result = simulatePayoff([{ ...loan, minimumPaymentCents: null }], 0, "minimum");
    expect(result.assumedMinimums).toEqual(["loan"]);
    expect(result.firstMonthPayments.loan).toBe(2_000);
  });
});

describe("comparePayoff", () => {
  it("avalanche never costs more interest than snowball, and both beat minimums", () => {
    const { minimum, avalanche, snowball } = comparePayoff([card, loan], 10_000);
    expect(avalanche.totalInterestCents).toBeLessThanOrEqual(snowball.totalInterestCents);
    expect(avalanche.totalInterestCents).toBeLessThan(minimum.totalInterestCents);
    expect(avalanche.interestSavedCents).toBe(minimum.totalInterestCents - avalanche.totalInterestCents);
  });
});
