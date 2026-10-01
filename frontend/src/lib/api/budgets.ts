import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type BudgetMethod = "zero_based" | "fifty_thirty_twenty" | "seventy_twenty_ten" | "category_caps";
export type BudgetStatus = "none" | "ok" | "warning" | "over";

export interface PlanCategory {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  /** Needs are essential categories; wants are the rest. */
  essential: boolean;
  budgetId: string | null;
  /** This month's budget; null when the category has none. */
  amountCents: number | null;
  rollover: boolean;
  /** Carried from last month (negative after overspending). */
  carryCents: number;
  /** Budget plus carry; null without a budget. */
  availableCents: number | null;
  spentCents: number;
  remainingCents: number | null;
  /** Mean of the last 3 complete months. */
  averageCents: number;
  /** Median of the last 3 complete months. */
  suggestedCents: number;
  status: BudgetStatus;
}

export interface PlanGroup {
  plannedCents: number;
  spentCents: number;
  categories: PlanCategory[];
}

export interface TargetCheck {
  bucket: "payFirst" | "needs" | "wants" | "living";
  percent: number;
  kind: "min" | "max";
  targetCents: number;
  plannedCents: number;
  actualCents: number;
  plannedOk: boolean;
  actualOk: boolean;
}

export interface SpendingPlan {
  year: number;
  month: number;
  plan: {
    id: string | null;
    method: BudgetMethod;
    /** What the plan uses: set, else suggested, else this month's income so far. */
    expectedIncomeCents: number;
    expectedIncomeSetCents: number | null;
    suggestedIncomeCents: number | null;
    notes: string | null;
  };
  income: { actualCents: number };
  payFirst: {
    plannedCents: number;
    actualCents: number;
    /** Transfers to savings, investments and debt not made by goals. */
    otherSavingCents: number;
    goals: Array<{
      goalId: string;
      name: string;
      color: string;
      icon: string;
      fundingRule: string;
      plannedCents: number;
      actualCents: number;
    }>;
  };
  needs: PlanGroup;
  wants: PlanGroup;
  overallCap: { budgetId: string; amountCents: number; spentCents: number } | null;
  evaluation: { leftToAssignCents: number; checks: TargetCheck[] };
  hasBudgets: boolean;
  previousHasBudgets: boolean;
}

/** Amount in major units; null removes the budget. */
export interface BudgetItem {
  categoryId: string;
  amount: number | null;
  rollover?: boolean;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function data<T>(request: Promise<ApiResponse<T>>) {
  return (await request).data;
}

export const budgetsApi = {
  getPlan: (year: number, month: number) =>
    data(apiClient<ApiResponse<SpendingPlan>>(`/budgets/plan?year=${year}&month=${month}`)),
  updatePlan: (payload: { year: number; month: number; method?: BudgetMethod; expectedIncome?: number | null }) =>
    data(apiClient<ApiResponse<SpendingPlan>>("/budgets/plan", json("PUT", payload))),
  saveBudgets: (year: number, month: number, items: BudgetItem[]) =>
    data(apiClient<ApiResponse<{ saved: number }>>("/budgets/bulk", json("PUT", { year, month, items }))),
  copyPrevious: (year: number, month: number) =>
    data(apiClient<ApiResponse<{ copied: number }>>("/budgets/copy", json("POST", { year, month }))),
};
