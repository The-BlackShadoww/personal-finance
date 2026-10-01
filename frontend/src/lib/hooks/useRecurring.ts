"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recurringApi, type RecurringPayload } from "@/lib/api/recurring";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";

export const recurringQueryOptions = () =>
  queryOptions({ queryKey: ["recurring"], queryFn: recurringApi.list, staleTime: 30_000 });

export function useRecurring() {
  return useQuery(recurringQueryOptions());
}

// Rules post entries (and those feed goals and plans), so changes refresh
// the same data as a transaction change.
function useRecurringMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export const useCreateRecurring = () => useRecurringMutation((payload: RecurringPayload) => recurringApi.create(payload));
export const useUpdateRecurring = () =>
  useRecurringMutation(({ id, payload }: { id: string; payload: Partial<RecurringPayload> }) => recurringApi.update(id, payload));
export const useConfirmOccurrence = () =>
  useRecurringMutation(({ id, amount }: { id: string; amount?: number }) => recurringApi.confirm(id, amount));
export const useSkipOccurrence = () => useRecurringMutation((id: string) => recurringApi.skip(id));
export const usePauseRecurring = () => useRecurringMutation((id: string) => recurringApi.pause(id));
export const useResumeRecurring = () => useRecurringMutation((id: string) => recurringApi.resume(id));
export const useDeleteRecurring = () => useRecurringMutation((id: string) => recurringApi.remove(id));
