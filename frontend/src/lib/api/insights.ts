import type { ApiResponse } from "@/types/api";

import type { AccountKind } from "./accounts";
import { apiClient } from "./client";

export type NetWorthPoint = {
  /** "YYYY-MM"; the last point is today. */
  month: string;
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
};

export type Runway = {
  liquidCents: number;
  averageExpenseCents: number | null;
  averageEssentialCents: number | null;
  /** Months liquid money lasts at the current lifestyle. */
  fullMonths: number | null;
  /** Months it lasts on essentials only. */
  essentialMonths: number | null;
};

export type HealthMetricKey =
  | "savings_rate"
  | "investing_rate"
  | "emergency_cover"
  | "debt_service"
  | "high_interest_debt"
  | "housing_cost"
  | "fixed_costs"
  | "net_worth_trend"
  | "protection";

export type HealthMetric = {
  key: HealthMetricKey;
  label: string;
  weight: number;
  available: boolean;
  value: number | null;
  /** percent: 18.5 = 18.5%; share: 0–100 of the covers needed. */
  unit: "percent" | "months" | "cents" | "cents_per_month" | "share";
  poor: number;
  healthy: number;
  score: number | null;
  tip: string;
};

export type HealthBand = "building" | "stable" | "strong" | "thriving";

export type HealthScore = {
  score: number | null;
  band: HealthBand | null;
  metrics: HealthMetric[];
};

export type NextAction = {
  key:
    | "cover_overspend"
    | "start_tracking"
    | "starter_buffer"
    | "employer_match"
    | "high_interest_debt"
    | "emergency_fund"
    | "invest_more"
    | "sinking_fund"
    | "protection"
    | "on_track";
  /** The waterfall step it serves (W1–W10). */
  step: string | null;
  title: string;
  detail: string;
  amountCents: number | null;
  monthlyCents: number | null;
  months: number | null;
  href: string;
  cta: string;
};

export type SpendingInsight = {
  kind: "category_drift" | "unusual_transaction" | "subscription" | "lifestyle_creep";
  title: string;
  detail: string;
  amountCents: number;
  categoryId: string | null;
  transactionId: string | null;
  href: string;
};

export type ValuationPrompt = {
  accountId: string;
  name: string;
  kind: AccountKind;
  lastValuedOn: string | null;
  daysSince: number | null;
};

export type InsightsOverview = {
  asOf: string;
  incomeBasis: "take_home";
  hasHistory: boolean;
  netWorth: {
    currentCents: number;
    assetsCents: number;
    liabilitiesCents: number;
    changeSixMonthsCents: number | null;
    series: NetWorthPoint[];
  };
  availableToSpendCents: number;
  runway: Runway;
  rates: { savingsRate: number | null; investingRate: number | null };
  averages: { incomeCents: number | null; expenseCents: number | null; essentialCents: number | null };
  health: HealthScore;
  nextAction: NextAction;
  insights: SpendingInsight[];
  valuationPrompts: ValuationPrompt[];
};

/** The compact insights the dashboard shows. */
export type DashboardInsights = {
  netWorth: { currentCents: number; changeSixMonthsCents: number | null; trend: number[] };
  runway: Runway;
  health: { score: number | null; band: HealthBand | null };
  nextAction: NextAction;
  insights: SpendingInsight[];
  valuationPrompts: ValuationPrompt[];
};

export const HEALTH_BANDS: Record<HealthBand, { label: string; className: string }> = {
  building: { label: "Building", className: "bg-yellow-bg text-yellow-fg" },
  stable: { label: "Stable", className: "bg-surface-3 text-foreground" },
  strong: { label: "Strong", className: "bg-green-bg text-green-fg" },
  thriving: { label: "Thriving", className: "bg-green-bg text-green-fg" },
};

export const insightsApi = {
  async getOverview(months = 24): Promise<InsightsOverview> {
    const response = await apiClient<ApiResponse<InsightsOverview>>(`/insights?months=${months}`);
    return response.data;
  },
};
