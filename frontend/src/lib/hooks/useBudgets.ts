"use client";

import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsApi, type BudgetItem, type BudgetMethod } from "@/lib/api/budgets";

export const planQueryOptions = (year: number, month: number) =>
  queryOptions({
    queryKey: ["budgets", "plan", year, month],
    queryFn: () => budgetsApi.getPlan(year, month),
    staleTime: 30_000,
  });

export function usePlan(year: number, month: number) {
  // Keep the previous month on screen while the next one loads.
  return useQuery({ ...planQueryOptions(year, month), placeholderData: keepPreviousData });
}

// Budgets only affect the plan; transactions and goals invalidate it too
// (see invalidateFinancialData).
function usePlanMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }) });
}

export const useUpdatePlan = () =>
  usePlanMutation((payload: { year: number; month: number; method?: BudgetMethod; expectedIncome?: number | null }) =>
    budgetsApi.updatePlan(payload),
  );

export const useSaveBudgets = () =>
  usePlanMutation(({ year, month, items }: { year: number; month: number; items: BudgetItem[] }) =>
    budgetsApi.saveBudgets(year, month, items),
  );

export const useCopyPreviousBudgets = () =>
  usePlanMutation(({ year, month }: { year: number; month: number }) => budgetsApi.copyPrevious(year, month));
