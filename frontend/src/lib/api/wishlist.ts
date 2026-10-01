import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export type WishlistDecision = "pending" | "bought" | "skipped";

export interface WishlistItem {
  id: string;
  name: string;
  amountCents: number;
  url: string | null;
  categoryId: string | null;
  /** When the cooling-off time ends (ISO). */
  coolUntil: string;
  decision: WishlistDecision;
  decidedAt: string | null;
  transactionId: string | null;
  createdAt: string;
  /** Waiting and the cooling-off time has passed. */
  ready: boolean;
}

export interface WishlistOverview {
  pending: WishlistItem[];
  decided: WishlistItem[];
  summary: {
    year: number;
    readyCount: number;
    waitingCents: number;
    skippedThisYearCents: number;
    skippedThisYearCount: number;
    boughtThisYearCents: number;
  };
  settings: { thresholdCents: number | null; hours: number };
}

/** Amount in major units. */
export interface WishlistPayload {
  name: string;
  amount: number;
  url?: string;
  categoryId?: string;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function data<T>(request: Promise<ApiResponse<T>>) {
  return (await request).data;
}

export const wishlistApi = {
  list: () => data(apiClient<ApiResponse<WishlistOverview>>("/wishlist")),
  create: (payload: WishlistPayload) => data(apiClient<ApiResponse<WishlistItem>>("/wishlist", json("POST", payload))),
  decide: (id: string, decision: WishlistDecision, transactionId?: string) =>
    data(apiClient<ApiResponse<WishlistItem>>(`/wishlist/${id}`, json("PATCH", { decision, transactionId }))),
  remove: (id: string) => data(apiClient<ApiResponse<{ success: boolean }>>(`/wishlist/${id}`, { method: "DELETE" })),
};
