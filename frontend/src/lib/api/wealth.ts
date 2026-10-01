import type { ApiResponse } from "@/types/api";

import type { AccountKind, AssetClass } from "./accounts";
import { apiClient } from "./client";

export type WealthDebt = {
  accountId: string;
  name: string;
  kind: AccountKind;
  balanceCents: number;
  aprBps: number | null;
  minimumPaymentCents: number | null;
};

export type InvestmentAccount = {
  accountId: string;
  name: string;
  kind: AccountKind;
  assetClass: AssetClass;
  /** False when the account has no asset class (counted as "other"). */
  assetClassSet: boolean;
  valueCents: number;
  startValueCents: number;
  /** Net money moved in over the last year. */
  contributedCents: number;
  gainCents: number;
  /** Last 12 months, Modified Dietz; null with nothing invested. */
  returnPercent: number | null;
  hasValuation: boolean;
  lastValuedOn: string | null;
  expenseRatioBps: number | null;
  annualFeeCents: number;
  /** Extra cost over 20 years vs a 0.2% fund. */
  feeDrag20yCents: number;
};

export type AllocationRow = {
  assetClass: AssetClass;
  valueCents: number;
  percent: number;
  targetPercent: number | null;
  driftPoints: number | null;
};

export type IncomeKind = "active" | "passive" | "portfolio" | "unclassified";

export type IncomeSource = {
  categoryId: string;
  name: string;
  kind: IncomeKind;
  last12Cents: number;
  share: number;
  /** Of the last 6 months. */
  monthsPaid: number;
};

export type WealthOverview = {
  asOf: string;
  assumptions: { safeWithdrawalBps: number; expectedRealReturnBps: number; retirementAgeTarget: number | null };
  debts: WealthDebt[];
  defaultAccount: { id: string; name: string } | null;
  fi: {
    monthlyExpenseCents: number | null;
    annualExpenseCents: number | null;
    monthlyIncomeCents: number | null;
    investedCents: number;
    monthlyInvestingCents: number;
    passiveCoverage: number | null;
  };
  investments: {
    accounts: InvestmentAccount[];
    totalCents: number;
    returnPercent: number | null;
    allocation: {
      rows: AllocationRow[];
      totalCents: number;
      maxDriftPoints: number | null;
      advice: "none" | "at_yearly_review" | "now";
    };
    targets: Array<{ assetClass: AssetClass; percent: number }>;
    annualFeesCents: number;
    feeDrag20yCents: number;
    /** Of the last 12 months. */
    contributionMonths: number;
  };
  income: {
    last12Cents: number;
    byKind: Record<IncomeKind, number>;
    sources: IncomeSource[];
    activeSourceCount: number;
    largestSource: IncomeSource | null;
    concentrated: boolean;
    passiveCoverage: number | null;
    yearOverYearGrowth: number | null;
  };
};

export const wealthApi = {
  async getOverview(): Promise<WealthOverview> {
    const response = await apiClient<ApiResponse<WealthOverview>>("/wealth");
    return response.data;
  },

  async setTargets(targets: Array<{ assetClass: AssetClass; percent: number }>) {
    const response = await apiClient<ApiResponse<Array<{ assetClass: AssetClass; percent: number }>>>(
      "/wealth/target-allocation",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targets }) },
    );
    return response.data;
  },
};
