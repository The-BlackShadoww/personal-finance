import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  transactionsApi,
  type TransactionPayload,
} from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";

type UpdateTransactionVariables = {
  id: string;
  payload: Partial<TransactionPayload>;
};

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateTransactionVariables) =>
      transactionsApi.update(id, payload),
    onSuccess: () => {
      void invalidateFinancialData(queryClient);
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

  return "Unable to update transaction.";
}
