"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financialProfileApi, type UpdateFinancialProfilePayload } from "@/lib/api/financialProfile";

export const financialProfileKeys = {
  all: ["financial-profile"] as const,
};

export function useFinancialProfile() {
  return useQuery({
    queryKey: financialProfileKeys.all,
    queryFn: financialProfileApi.get,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateFinancialProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateFinancialProfilePayload) => financialProfileApi.update(data),
    onSuccess: (profile) => {
      queryClient.setQueryData(financialProfileKeys.all, profile);
    },
  });
}
