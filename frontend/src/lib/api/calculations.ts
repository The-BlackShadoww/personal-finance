import type { ApiResponse } from "@/types/api";

import type { AccountSummary } from "./account";
import { apiClient } from "./client";

export type MonthRange = {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
};

export type RangeSummary = MonthRange &
  PeriodSummary & {
    monthsIncluded: number;
  };

/** Everything the monthly dashboard renders, fetched in one request. */
export type DashboardOverview = {
  year: number;
  month: number;
  monthly: MonthlySummary;
  yearly: YearlySummary;
  /** Present when the six-month trend reaches into the previous year. */
  previousYearly: YearlySummary | null;
  categoryBreakdown: CategoryBreakdownItem[];
  account: AccountSummary;
};

export type PeriodSummary = {
  totalIncome: number;
  totalExpense: number;
  savings: number;
  savingsRate: number | string;
  transactionCount: number;
};

export type MonthlySummary = PeriodSummary & {
  year: number;
  month: number;
};

export type MonthlyBreakdownItem = {
  month: number;
  totalIncome: number;
  totalExpense: number;
  savings: number;
  transactionCount: number;
};

export type YearlySummary = PeriodSummary & {
  year: number;
  monthlyBreakdown: MonthlyBreakdownItem[];
};

export type QuarterlySummary = {
  year: number;
  quarter: number;
  startMonth: number;
  endMonth: number;
  totalIncome: number;
  totalExpense: number;
  savings: number;
  savingsRate: string;
  monthlyBreakdown: MonthlyBreakdownItem[];
};

export type CategoryBreakdownItem = {
  name: string;
  color?: string | null;
  icon?: string | null;
  type: "income" | "expense";
  total: number;
  count: number;
};

export const calculationsApi = {
  async getMonthlySummary(year: number, month: number) {
    const response = await apiClient<ApiResponse<MonthlySummary>>(
      `/calculations/monthly?year=${year}&month=${month}`,
    );

    return response.data;
  },

  async getQuarterlySummary(year: number, quarter: number) {
    const response = await apiClient<ApiResponse<QuarterlySummary>>(
      `/calculations/quarterly?year=${year}&quarter=${quarter}`,
    );

    return response.data;
  },

  async getYearlySummary(year: number) {
    const response = await apiClient<ApiResponse<YearlySummary>>(
      `/calculations/yearly?year=${year}`,
    );

    return response.data;
  },

  async getCategoryBreakdown(year: number, month: number) {
    const response = await apiClient<ApiResponse<CategoryBreakdownItem[]>>(
      `/calculations/category-breakdown?year=${year}&month=${month}`,
    );

    return response.data;
  },

  async getRangeSummary(range: MonthRange) {
    const params = new URLSearchParams({
      startYear: String(range.startYear),
      startMonth: String(range.startMonth),
      endYear: String(range.endYear),
      endMonth: String(range.endMonth),
    });
    const response = await apiClient<ApiResponse<RangeSummary>>(
      `/calculations/range?${params.toString()}`,
    );

    return response.data;
  },

  async getDashboardOverview(year: number, month: number) {
    const response = await apiClient<ApiResponse<DashboardOverview>>(
      `/calculations/dashboard?year=${year}&month=${month}`,
    );

    return response.data;
  },
};

export function getQuarterlySummary(year: number, quarter: number) {
  return calculationsApi.getQuarterlySummary(year, quarter);
}

export function getYearlySummary(year: number) {
  return calculationsApi.getYearlySummary(year);
}
