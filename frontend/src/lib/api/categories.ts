import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type CategoryType = 'income' | 'expense';

/** Marks an expense category that feeds a specific ratio (housing cost, debt service, …). */
export type CategoryTag = 'housing' | 'debt_interest' | 'insurance' | 'education' | 'health';

export type IncomeKind = 'active' | 'passive' | 'portfolio';

/** Classification fields; spending ones apply to expense categories, incomeKind to income. */
export interface CategoryClassification {
  essential?: boolean;
  fixed?: boolean;
  tag?: CategoryTag | null;
  incomeKind?: IncomeKind | null;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  isDefault: boolean;
  sortOrder: number;
  /** A need rather than a want. */
  essential: boolean;
  /** Roughly the same amount every month. */
  fixed: boolean;
  tag: CategoryTag | null;
  incomeKind: IncomeKind | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryPayload extends CategoryClassification {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export interface UpdateCategoryPayload extends CategoryClassification {
  name?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export const categoriesApi = {
  async getAll(): Promise<Category[]> {
    const response = await apiClient<ApiResponse<Category[]>>("/categories");

    return response.data;
  },

  async create(data: CreateCategoryPayload): Promise<Category> {
    const response = await apiClient<ApiResponse<Category>>("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    return response.data;
  },

  async update(id: string, data: UpdateCategoryPayload): Promise<Category> {
    const response = await apiClient<ApiResponse<Category>>(
      `/categories/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );

    return response.data;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const response = await apiClient<ApiResponse<{ success: boolean }>>(
      `/categories/${id}`,
      { method: "DELETE" },
    );

    return response.data;
  },
};
