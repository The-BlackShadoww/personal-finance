'use client';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi, type SetupAccountPayload, type UpsertSectorPayload } from '@/lib/api/account';
export const accountKeys = { all: ['account'] as const, summary: () => [...accountKeys.all, 'summary'] as const };
// The dashboard overview embeds the account summary, so it goes stale too.
const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => Promise.all([queryClient.invalidateQueries({ queryKey: accountKeys.summary() }), queryClient.invalidateQueries({ queryKey: ["calculations", "dashboard"] })]);
export const accountSummaryQueryOptions = () => queryOptions({ queryKey: accountKeys.summary(), queryFn: accountApi.getSummary, staleTime: 30_000 });
export function useAccountSummary() { return useQuery(accountSummaryQueryOptions()); }
export function useSetupAccount() { const qc = useQueryClient(); return useMutation({ mutationFn: (data: SetupAccountPayload) => accountApi.setup(data), onSuccess: () => invalidate(qc) }); }
export function useCreateSector() { const qc = useQueryClient(); return useMutation({ mutationFn: (data: UpsertSectorPayload) => accountApi.createSector(data), onSuccess: () => invalidate(qc) }); }
export function useUpdateSector() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpsertSectorPayload }) => accountApi.updateSector(id, data), onSuccess: () => invalidate(qc) }); }
export function useDeleteSector() { const qc = useQueryClient(); return useMutation({ mutationFn: accountApi.deleteSector, onSuccess: () => invalidate(qc) }); }
