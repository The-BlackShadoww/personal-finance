import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { transactionsApi } from "@/lib/api/transactions";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      void invalidateFinancialData(queryClient);
      toast.success("Transaction deleted.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to delete transaction.";
}
