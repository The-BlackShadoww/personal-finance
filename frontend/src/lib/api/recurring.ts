import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";
import type { GoalMovement, TransactionType } from "./transactions";

export type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringRule {
  id: string;
  name: string;
  type: TransactionType;
  amountCents: number;
  accountId: string;
  counterAccountId: string | null;
  categoryId: string | null;
  note: string | null;
  frequency: Frequency;
  anchorDate: string;
  endDate: string | null;
  /** Null once the rule has ended. */
  nextDueDate: string | null;
  /** Billing month relative to the date: -1, 0 or +1. */
  periodOffsetMonths: number;
  autoPost: boolean;
  isSubscription: boolean;
  pausedAt: string | null;
  accountName: string;
  counterAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  monthlyEquivalentCents: number;
}

export interface Occurrence {
  ruleId: string;
  name: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  autoPost?: boolean;
}

export interface RecurringOverview {
  rules: RecurringRule[];
  /** Occurrences waiting for confirmation. */
  due: Occurrence[];
  /** Up to the same date next month. */
  upcoming: Occurrence[];
  subscriptions: { count: number; monthlyCents: number; yearlyCents: number };
}

/** Amounts in major units. */
export interface RecurringPayload {
  name: string;
  type: TransactionType;
  amount: number;
  accountId?: string;
  counterAccountId?: string;
  categoryId?: string;
  note?: string;
  frequency: Frequency;
  anchorDate: string;
  endDate?: string | null;
  periodOffsetMonths?: number;
  autoPost?: boolean;
  isSubscription?: boolean;
  fromTransactionId?: string;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function data<T>(request: Promise<ApiResponse<T>>) {
  return (await request).data;
}

export const recurringApi = {
  list: () => data(apiClient<ApiResponse<RecurringOverview>>("/recurring")),
  create: (payload: RecurringPayload) => data(apiClient<ApiResponse<RecurringRule>>("/recurring", json("POST", payload))),
  update: (id: string, payload: Partial<Omit<RecurringPayload, "fromTransactionId">>) =>
    data(apiClient<ApiResponse<RecurringRule>>(`/recurring/${id}`, json("PATCH", payload))),
  confirm: (id: string, amount?: number) =>
    data(
      apiClient<ApiResponse<{ posted: boolean; date: string; goalAllocation: GoalMovement[] }>>(
        `/recurring/${id}/confirm`,
        json("POST", amount === undefined ? {} : { amount }),
      ),
    ),
  skip: (id: string) =>
    data(apiClient<ApiResponse<{ skipped: string; nextDueDate: string | null }>>(`/recurring/${id}/skip`, { method: "POST" })),
  pause: (id: string) => data(apiClient<ApiResponse<RecurringRule>>(`/recurring/${id}/pause`, { method: "POST" })),
  resume: (id: string) => data(apiClient<ApiResponse<RecurringRule>>(`/recurring/${id}/resume`, { method: "POST" })),
  remove: (id: string) => data(apiClient<ApiResponse<{ success: boolean }>>(`/recurring/${id}`, { method: "DELETE" })),
};
