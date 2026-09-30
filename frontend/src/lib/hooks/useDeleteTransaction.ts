import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { transactionsApi, type TransactionsResponse } from "@/lib/api/transactions";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    // Optimistic: drop the row from every cached transactions page right
    // away; restore the snapshots if the server rejects the delete.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const snapshots = queryClient.getQueriesData<TransactionsResponse>({ queryKey: ["transactions"] });

      for (const [key, page] of snapshots) {
        if (!page?.data.some((transaction) => transaction.id === id)) continue;
        queryClient.setQueryData<TransactionsResponse>(key, {
          ...page,
          data: page.data.filter((transaction) => transaction.id !== id),
          total: Math.max(page.total - 1, 0),
        });
      }

      return { snapshots };
    },
    onSuccess: () => {
      toast.success("Transaction deleted.");
    },
    onError: (error, _id, context) => {
      for (const [key, page] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, page);
      }
      toast.error(getErrorMessage(error));
    },
    onSettled: () => {
      void invalidateFinancialData(queryClient);
    },
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to delete transaction.";
}
