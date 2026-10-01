"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetClass } from "@/lib/api/accounts";
import { wealthApi } from "@/lib/api/wealth";

export const wealthQueryOptions = () =>
  queryOptions({ queryKey: ["wealth"], queryFn: wealthApi.getOverview, staleTime: 60_000 });

export function useWealth(enabled = true) {
  return useQuery({ ...wealthQueryOptions(), enabled });
}

export function useSetTargetAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: Array<{ assetClass: AssetClass; percent: number }>) => wealthApi.setTargets(targets),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wealth"] }),
  });
}
