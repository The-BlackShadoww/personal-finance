import type { ApiResponse } from '@/types/api';
import { apiClient } from './client';

export interface SectorAllocation { id: string; name: string; percentage: number; color: string; icon: string; allocatedCents: number; targetAmountCents: number | null; progressPercent: number | null; sortOrder: number; isDefault: boolean; }
export interface CashAllocation { name: 'Cash'; percentage: number; allocatedCents: number; color: string; icon: string; }
export interface AccountSummary { currentBalanceCents: number; currentBalanceDollars: number; initialBalanceCents: number; totalIncomeCents: number; totalExpenseCents: number; lowBalanceThresholdCents: number; isLowBalance: boolean; netWorthCents: number; assetsCents: number; liabilitiesCents: number; sectors: SectorAllocation[]; cash: CashAllocation; }
export interface SetupAccountPayload { initialBalance: number; lowBalanceThreshold?: number; }
export interface UpsertSectorPayload { name: string; percentage: number; color?: string; icon?: string; targetAmount?: number; sortOrder?: number; }

async function unwrap<T>(request: Promise<ApiResponse<T> | T>) { const result = await request; return 'data' in (result as object) ? (result as ApiResponse<T>).data : result as T; }
export const accountApi = {
  getSummary: () => unwrap(apiClient<ApiResponse<AccountSummary>>('/account/summary')),
  setup: (data: SetupAccountPayload) => unwrap(apiClient<ApiResponse<{ initialBalance: number; lowBalanceThreshold: number }>>('/account/setup', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })),
  createSector: (data: UpsertSectorPayload) => unwrap(apiClient<ApiResponse<SectorAllocation>>('/account/sectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })),
  updateSector: (id: string, data: UpsertSectorPayload) => unwrap(apiClient<ApiResponse<SectorAllocation>>(`/account/sectors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })),
  deleteSector: (id: string) => unwrap(apiClient<ApiResponse<{ success: boolean }>>(`/account/sectors/${id}`, { method: 'DELETE' })),
};
