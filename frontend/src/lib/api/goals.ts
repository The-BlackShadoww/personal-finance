import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type GoalKind = "emergency" | "sinking" | "long_term" | "custom";
export type FundingRule = "percent_of_income" | "fixed_monthly" | "manual";
export type WithdrawalReason = "emergency" | "planned_purchase" | "rebalancing" | "other";
export type GoalStatus = "done" | "ahead" | "on_track" | "behind" | "open";

export interface Goal {
  id: string;
  name: string;
  kind: GoalKind;
  accountId: string;
  account: { id: string; name: string; kind: string; isLiquid: boolean } | null;
  /** For the emergency fund: computed from essential spending; null without data. */
  targetAmountCents: number | null;
  /** For yearly sinking funds: the next occurrence. */
  targetDate: string | null;
  repeatsYearly: boolean;
  categoryId: string | null;
  /** Order income is shared out in; lower first. */
  priority: number;
  fundingRule: FundingRule;
  fundingPercentBps: number | null;
  fundingAmountCents: number | null;
  color: string;
  icon: string;
  archivedAt: string | null;
  balanceCents: number;
  /** Average monthly contributions over the last 90 days. */
  paceMonthlyCents: number;
  progress: {
    percent: number | null;
    requiredMonthlyCents: number | null;
    /** "YYYY-MM" the target is reached at the current pace. */
    projectedCompletion: string | null;
    status: GoalStatus;
  };
  emergency: {
    targetMonths: number;
    /** Null when following the financial profile. */
    targetMonthsSetting: number | null;
    averageEssentialMonthlyCents: number | null;
    monthsOfCover: number | null;
    /** One month of essentials: the starter buffer. */
    starterTargetCents: number | null;
  } | null;
}

export interface GoalsResponse {
  goals: Goal[];
  summary: {
    earmarkedCents: number;
    liquidCents: number;
    availableCents: number;
    averageEssentialMonthlyCents: number | null;
    /** Accounts whose goals claim more than they hold. */
    shortfalls: Array<{ accountId: string; accountName: string; shortfallCents: number }>;
  };
}

/** Amounts in major units; percents as percents. */
export interface GoalPayload {
  name: string;
  kind: Exclude<GoalKind, "emergency">;
  accountId: string;
  targetAmount?: number | null;
  targetDate?: string | null;
  repeatsYearly?: boolean;
  categoryId?: string | null;
  fundingRule?: FundingRule;
  fundingPercent?: number | null;
  fundingAmount?: number | null;
  color?: string;
  icon?: string;
}

export type GoalUpdatePayload = Partial<Omit<GoalPayload, "kind">> & { targetMonths?: number | null };

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function data<T>(request: Promise<ApiResponse<T>>) {
  return (await request).data;
}

export const goalsApi = {
  list: (includeArchived = false) =>
    data(apiClient<ApiResponse<GoalsResponse>>(`/goals${includeArchived ? "?includeArchived=true" : ""}`)),
  create: (payload: GoalPayload) => data(apiClient<ApiResponse<Goal>>("/goals", json("POST", payload))),
  update: (id: string, payload: GoalUpdatePayload) =>
    data(apiClient<ApiResponse<Goal>>(`/goals/${id}`, json("PATCH", payload))),
  reorder: (ids: string[]) => data(apiClient<ApiResponse<{ success: boolean }>>("/goals/reorder", json("POST", { ids }))),
  contribute: (id: string, payload: { amount: number; fromAccountId?: string; note?: string }) =>
    data(apiClient<ApiResponse<unknown>>(`/goals/${id}/contributions`, json("POST", payload))),
  withdraw: (id: string, payload: { amount: number; reason: WithdrawalReason; note?: string }) =>
    data(apiClient<ApiResponse<unknown>>(`/goals/${id}/withdrawals`, json("POST", payload))),
  archive: (id: string) => data(apiClient<ApiResponse<Goal>>(`/goals/${id}/archive`, { method: "POST" })),
  restore: (id: string) => data(apiClient<ApiResponse<Goal>>(`/goals/${id}/restore`, { method: "POST" })),
  remove: (id: string) => data(apiClient<ApiResponse<{ success: boolean }>>(`/goals/${id}`, { method: "DELETE" })),
  undoAllocation: (transactionId: string) =>
    data(apiClient<ApiResponse<{ released: number }>>(`/goals/allocations/${transactionId}`, { method: "DELETE" })),
};
