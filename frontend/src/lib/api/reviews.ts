import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type WorthIt = "yes" | "meh" | "no";

export interface ReviewItem {
  kind: string;
  title: string;
  detail: string;
  amountCents: number;
}

export interface ReviewSummary {
  year: number;
  month: number;
  completedAt: string;
  action: string | null;
  actionDone: boolean | null;
  healthScore: number | null;
}

export interface ReviewStatus {
  /** Last month, when it had activity and has not been reviewed. */
  due: { year: number; month: number } | null;
  history: ReviewSummary[];
}

export interface MonthlyReview {
  year: number;
  month: number;
  completed: {
    completedAt: string;
    worthIt: Record<string, WorthIt>;
    action: string | null;
    actionDone: boolean | null;
  } | null;
  numbers: {
    incomeCents: number;
    expenseCents: number;
    savingsRate: number | null;
    savingsTarget: number;
    netWorthChangeCents: number | null;
    healthScore: number | null;
    previousHealthScore: number | null;
  };
  wins: ReviewItem[];
  leaks: ReviewItem[];
  worthIt: Array<{ categoryId: string; name: string; spentCents: number; previousNo: number }>;
  suggestedActions: string[];
  previousAction: { year: number; month: number; action: string; done: boolean | null } | null;
}

export interface CompleteReviewPayload {
  worthIt: Record<string, WorthIt>;
  action?: string;
  previousActionDone?: boolean;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function data<T>(request: Promise<ApiResponse<T>>) {
  return (await request).data;
}

export const reviewsApi = {
  status: () => data(apiClient<ApiResponse<ReviewStatus>>("/reviews/status")),
  get: (year: number, month: number) => data(apiClient<ApiResponse<MonthlyReview>>(`/reviews/${year}/${month}`)),
  complete: (year: number, month: number, payload: CompleteReviewPayload) =>
    data(
      apiClient<ApiResponse<{ saved: boolean; lowerBudgets: Array<{ categoryId: string; name: string }> }>>(
        `/reviews/${year}/${month}`,
        json("PUT", payload),
      ),
    ),
};
