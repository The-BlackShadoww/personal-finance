import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type IncomeStability = "stable" | "variable";

export interface FinancialProfile {
  incomeStability: IncomeStability | null;
  dependents: number | null;
  hasHealthInsurance: boolean | null;
  hasLifeInsurance: boolean | null;
  /** Employer retirement match as a percent of salary; 0 = none offered. */
  employerMatchPercent: number | null;
  retirementAgeTarget: number | null;
  /** Basis points: 400 = 4%. */
  safeWithdrawalBps: number;
  /** Basis points after inflation: 500 = 5%. */
  expectedRealReturnBps: number;
  /** Non-essential purchases at or above this go to the cooling-off list; null = off. */
  coolingOffThresholdCents: number | null;
  /** Hours an item waits (24–720). */
  coolingOffHours: number;
  updatedAt: string | null;
  /** Every question that changes advice has an answer. */
  isComplete: boolean;
  /** What the last six complete months of income suggest. */
  incomeAssessment: {
    stability: IncomeStability | null;
    coefficientOfVariation: number | null;
    monthsConsidered: number;
  };
}

/** Omit a field to keep it; null clears an answer. */
export type UpdateFinancialProfilePayload = Partial<
  Pick<
    FinancialProfile,
    | "incomeStability"
    | "dependents"
    | "hasHealthInsurance"
    | "hasLifeInsurance"
    | "employerMatchPercent"
    | "retirementAgeTarget"
  >
> &
  Partial<Pick<FinancialProfile, "safeWithdrawalBps" | "expectedRealReturnBps" | "coolingOffHours">> & {
    /** Major units; null turns the cooling-off rule off. */
    coolingOffThreshold?: number | null;
  };

export const financialProfileApi = {
  async get(): Promise<FinancialProfile> {
    const response = await apiClient<ApiResponse<FinancialProfile>>("/profile/financial");
    return response.data;
  },

  async update(data: UpdateFinancialProfilePayload): Promise<FinancialProfile> {
    const response = await apiClient<ApiResponse<FinancialProfile>>("/profile/financial", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.data;
  },
};
