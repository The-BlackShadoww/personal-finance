"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { goalsApi, type GoalPayload, type GoalUpdatePayload, type WithdrawalReason } from "@/lib/api/goals";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";

export const goalsQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ["goals", { includeArchived }],
    queryFn: () => goalsApi.list(includeArchived),
    staleTime: 30_000,
  });

export function useGoals(includeArchived = false) {
  return useQuery(goalsQueryOptions(includeArchived));
}

// Goal money changes available-to-spend and may create transfers, so every
// goal change invalidates the same set as a transaction change.
function useGoalMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export const useCreateGoal = () => useGoalMutation((payload: GoalPayload) => goalsApi.create(payload));
export const useUpdateGoal = () =>
  useGoalMutation(({ id, payload }: { id: string; payload: GoalUpdatePayload }) => goalsApi.update(id, payload));
export const useReorderGoals = () => useGoalMutation((ids: string[]) => goalsApi.reorder(ids));
export const useContributeToGoal = () =>
  useGoalMutation(({ id, amount, fromAccountId }: { id: string; amount: number; fromAccountId?: string }) =>
    goalsApi.contribute(id, { amount, fromAccountId }),
  );
export const useWithdrawFromGoal = () =>
  useGoalMutation(({ id, ...payload }: { id: string; amount: number; reason: WithdrawalReason; note?: string }) =>
    goalsApi.withdraw(id, payload),
  );
export const useArchiveGoal = () => useGoalMutation((id: string) => goalsApi.archive(id));
export const useRestoreGoal = () => useGoalMutation((id: string) => goalsApi.restore(id));
export const useDeleteGoal = () => useGoalMutation((id: string) => goalsApi.remove(id));
export const useUndoAllocation = () => useGoalMutation((transactionId: string) => goalsApi.undoAllocation(transactionId));
