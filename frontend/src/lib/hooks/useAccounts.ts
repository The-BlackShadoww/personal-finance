"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsApi, type AccountPayload } from "@/lib/api/accounts";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";

export const accountsKeys = {
  all: ["accounts"] as const,
  list: (includeArchived: boolean) => [...accountsKeys.all, { includeArchived }] as const,
};

export const accountsQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: accountsKeys.list(includeArchived),
    queryFn: () => accountsApi.list(includeArchived),
    staleTime: 30_000,
  });

export function useAccounts(includeArchived = false) {
  return useQuery(accountsQueryOptions(includeArchived));
}

// Balances feed the dashboard, the account summary and every derived view,
// so account changes invalidate the same set as transaction changes.
function useAccountMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateFinancialData(queryClient),
  });
}

export function useCreateAccount() {
  return useAccountMutation((payload: AccountPayload) => accountsApi.create(payload));
}

export function useUpdateAccount() {
  return useAccountMutation(({ id, payload }: { id: string; payload: Partial<AccountPayload> }) =>
    accountsApi.update(id, payload),
  );
}

export function useArchiveAccount() {
  return useAccountMutation((id: string) => accountsApi.archive(id));
}

export function useRestoreAccount() {
  return useAccountMutation((id: string) => accountsApi.restore(id));
}

export function useDeleteAccount() {
  return useAccountMutation((id: string) => accountsApi.remove(id));
}

export function useAccountValuations(accountId: string | null) {
  return useQuery({
    queryKey: [...accountsKeys.all, "valuations", accountId],
    queryFn: () => accountsApi.listValuations(accountId as string),
    enabled: accountId !== null,
  });
}

// A valuation changes net worth everywhere it is shown.
export function useUpsertValuation() {
  return useAccountMutation(({ id, payload }: { id: string; payload: { date: string; value: number; note?: string } }) =>
    accountsApi.upsertValuation(id, payload),
  );
}

export function useDeleteValuation() {
  return useAccountMutation(({ id, valuationId }: { id: string; valuationId: string }) =>
    accountsApi.removeValuation(id, valuationId),
  );
}
