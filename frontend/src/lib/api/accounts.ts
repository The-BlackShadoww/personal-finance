import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type AccountKind =
  | "cash"
  | "bank"
  | "mobile_wallet"
  | "savings"
  | "investment"
  | "retirement"
  | "property"
  | "credit_card"
  | "loan"
  | "other";

/** Assets are owned; liabilities (credit cards, loans) are owed. */
export type AccountNature = "asset" | "liability";

export type AssetClass = "equity" | "bond" | "cash" | "real_estate" | "gold" | "mixed" | "other";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  nature: AccountNature;
  /** Spendable within days; counts toward available money. */
  isLiquid: boolean;
  /** New transactions default to this account. */
  isDefault: boolean;
  openingBalanceCents: number;
  /** Owned for assets, owed for liabilities. */
  balanceCents: number;
  /** Month-end balances, oldest first ("YYYY-MM"). */
  trend: Array<{ month: string; balanceCents: number }>;
  interestRateBps: number | null;
  minimumPaymentCents: number | null;
  creditLimitCents: number | null;
  assetClass: AssetClass | null;
  expenseRatioBps: number | null;
  color: string;
  icon: string;
  sortOrder: number;
  archivedAt: string | null;
}

export interface AccountTotals {
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
  /** Money available to spend: liquid asset accounts. */
  liquidCents: number;
}

export interface AccountsResponse {
  accounts: Account[];
  totals: AccountTotals;
}

/** Amounts in major units; percents as percents (24.5 = 24.5%). */
export interface AccountPayload {
  name: string;
  kind: AccountKind;
  openingBalance?: number;
  isLiquid?: boolean;
  isDefault?: boolean;
  interestRate?: number | null;
  minimumPayment?: number | null;
  creditLimit?: number | null;
  assetClass?: AssetClass | null;
  expenseRatio?: number | null;
  color?: string;
  icon?: string;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const accountsApi = {
  async list(includeArchived = false): Promise<AccountsResponse> {
    const response = await apiClient<ApiResponse<AccountsResponse>>(
      `/accounts${includeArchived ? "?includeArchived=true" : ""}`,
    );
    return response.data;
  },

  async create(payload: AccountPayload): Promise<Account> {
    const response = await apiClient<ApiResponse<Account>>("/accounts", json("POST", payload));
    return response.data;
  },

  async update(id: string, payload: Partial<AccountPayload>): Promise<Account> {
    const response = await apiClient<ApiResponse<Account>>(`/accounts/${id}`, json("PATCH", payload));
    return response.data;
  },

  async archive(id: string): Promise<Account> {
    const response = await apiClient<ApiResponse<Account>>(`/accounts/${id}/archive`, { method: "POST" });
    return response.data;
  },

  async restore(id: string): Promise<Account> {
    const response = await apiClient<ApiResponse<Account>>(`/accounts/${id}/restore`, { method: "POST" });
    return response.data;
  },

  async remove(id: string): Promise<{ success: boolean }> {
    const response = await apiClient<ApiResponse<{ success: boolean }>>(`/accounts/${id}`, { method: "DELETE" });
    return response.data;
  },
};
