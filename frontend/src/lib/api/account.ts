import type { ApiResponse } from '@/types/api';
import { apiClient } from './client';

/** A goal as the account summary lists it; see lib/api/goals for the full view. */
export interface EarmarkSummary { id: string; name: string; kind: string; color: string; icon: string; accountId: string; targetAmountCents: number | null; balanceCents: number; }
/** currentBalanceCents is liquid money; availableCents is the part not set aside for goals. */
export interface AccountSummary { currentBalanceCents: number; currentBalanceDollars: number; earmarkedCents: number; availableCents: number; initialBalanceCents: number; totalIncomeCents: number; totalExpenseCents: number; lowBalanceThresholdCents: number; isLowBalance: boolean; netWorthCents: number; assetsCents: number; liabilitiesCents: number; goals: EarmarkSummary[]; }
export interface SetupAccountPayload { initialBalance: number; lowBalanceThreshold?: number; }

async function unwrap<T>(request: Promise<ApiResponse<T> | T>) { const result = await request; return 'data' in (result as object) ? (result as ApiResponse<T>).data : result as T; }
export const accountApi = {
  getSummary: () => unwrap(apiClient<ApiResponse<AccountSummary>>('/account/summary')),
  setup: (data: SetupAccountPayload) => unwrap(apiClient<ApiResponse<{ initialBalance: number; lowBalanceThreshold: number }>>('/account/setup', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })),
};
