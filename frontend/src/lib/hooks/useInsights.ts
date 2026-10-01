"use client";

import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { insightsApi } from "@/lib/api/insights";

export const insightsKeys = {
  all: ["insights"] as const,
  overview: (months: number) => [...insightsKeys.all, { months }] as const,
};

export const insightsQueryOptions = (months = 24) =>
  queryOptions({
    queryKey: insightsKeys.overview(months),
    queryFn: () => insightsApi.getOverview(months),
    staleTime: 60_000,
  });

export function useInsights(months = 24) {
  // Keep the previous range on screen while another loads.
  return useQuery({ ...insightsQueryOptions(months), placeholderData: keepPreviousData });
}
