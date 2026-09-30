import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import {
  transactionsApi,
  type TransactionFilters,
} from "@/lib/api/transactions";

/** Shared by the hook and by route prefetching so both hit the same cache entry. */
export function transactionsQueryOptions(filters: TransactionFilters) {
  return queryOptions({
    queryKey: ["transactions", filters],
    queryFn: () => transactionsApi.getAll(filters),
    staleTime: 60 * 1000,
  });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    ...transactionsQueryOptions(filters),
    // Keep showing the previous period or page while the next one loads.
    placeholderData: keepPreviousData,
  });
}
