import type { ApiResponse } from "@/types/api";

import type { AccountKind } from "./accounts";
import { apiClient } from "./client";

/** A transfer moves money between two of the user's accounts; it is not income or spending. */
export type TransactionType = "income" | "expense" | "transfer";

export type TransactionFilters = {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
};

export type TransactionCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
  color?: string | null;
  icon?: string | null;
};

export type TransactionAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  nature: "asset" | "liability";
  color: string;
  icon: string;
};

export type Transaction = {
  id: string;
  /** Income/expense: where money arrived or left. Transfer: the source. */
  accountId: string;
  /** Transfers only: the destination. */
  counterAccountId: string | null;
  /** Null for transfers. */
  categoryId: string | null;
  type: TransactionType;
  amountCents: number;
  date: string;
  transactionMonth: number;
  transactionYear: number;
  note?: string | null;
  category: TransactionCategory | null;
  account: TransactionAccount;
  counterAccount: TransactionAccount | null;
};

/** A goal's share of an income, or what a goal paid towards an expense. */
export type GoalMovement = { goalId: string; name: string; amountCents: number };

/** What creating an entry returns: the entry plus what goals did because of it. */
export type CreatedTransaction = Transaction & {
  goalAllocation: GoalMovement[];
  goalPayment: GoalMovement | null;
};

export type TransactionsResponse = {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
};

export type TransactionPayload = {
  type: TransactionType;
  /** Required for income and expense; omitted for transfers. */
  categoryId?: string;
  /** Defaults to the default account. */
  accountId?: string;
  /** Required for transfers. */
  counterAccountId?: string;
  /** Expenses only: pay from this goal (e.g. a sinking fund). */
  payFromGoalId?: string;
  amount: number;
  date: string;
  transactionMonth: number;
  transactionYear: number;
  note?: string;
};

export const transactionsApi = {
  async getAll(filters: TransactionFilters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    const response = await apiClient<ApiResponse<TransactionsResponse>>(
      `/transactions${queryString ? `?${queryString}` : ""}`,
    );

    return response.data;
  },

  async create(payload: TransactionPayload) {
    const response = await apiClient<ApiResponse<CreatedTransaction>>(
      "/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async update(id: string, payload: Partial<TransactionPayload>) {
    const response = await apiClient<ApiResponse<Transaction>>(
      `/transactions/${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient<ApiResponse<{ success: boolean }>>(
      `/transactions/${id}`,
      {
        method: "DELETE",
      },
    );

    return response.data;
  },
};
