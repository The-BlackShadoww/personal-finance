import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MONEY_FORMAT,
  currencySymbol,
  formatCents,
  formatCompactMoney,
  formatMoney,
  formatMoneyAbs,
  parseAmountInput,
  setMoneyFormat,
} from "./money";

afterEach(() => setMoneyFormat(DEFAULT_MONEY_FORMAT));

describe("money formatting", () => {
  it("defaults to US dollars", () => {
    expect(formatMoney(1500.5)).toBe("$1,500.50");
    expect(formatMoney(-1500.5)).toBe("-$1,500.50");
    expect(formatMoney(1500.5, 0)).toBe("$1,501");
  });

  it("follows the active currency and locale", () => {
    setMoneyFormat({ currency: "BDT", locale: "en-IN" });
    expect(formatMoney(1234567.5)).toBe("৳12,34,567.50");
    expect(currencySymbol()).toBe("৳");
  });

  it("keeps Latin digits for locales with native numerals", () => {
    setMoneyFormat({ currency: "BDT", locale: "bn-BD" });
    expect(formatMoney(1500)).toMatch(/1,500\.00/);
  });

  it("formats cents and magnitudes", () => {
    setMoneyFormat({ currency: "EUR", locale: "de-DE" });
    expect(formatCents(150050).replace(/ /g, " ")).toBe("1.500,50 €");
    expect(formatMoneyAbs(-20).replace(/ /g, " ")).toBe("20,00 €");
  });

  it("abbreviates large values for chart axes", () => {
    expect(formatCompactMoney(12500)).toBe("$12.5K");
  });

  it("falls back to dollars for an invalid format", () => {
    setMoneyFormat({ currency: "NOPE", locale: "en-US" });
    expect(formatMoney(1)).toBe("$1.00");
  });
});

describe("parseAmountInput", () => {
  it("reads grouping commas and decimal commas", () => {
    expect(parseAmountInput("1,250.50")).toBe(1250.5);
    expect(parseAmountInput("1250,50")).toBe(1250.5);
    expect(parseAmountInput("1.250,50")).toBe(1250.5);
    expect(parseAmountInput("1,250")).toBe(1250);
  });
  it("treats empty as cleared and junk as invalid", () => {
    expect(parseAmountInput("  ")).toBeNull();
    expect(parseAmountInput("abc")).toBeNaN();
  });
});
