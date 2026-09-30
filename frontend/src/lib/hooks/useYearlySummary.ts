import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getYearlySummary } from "@/lib/api/calculations";

export const yearlyKeys = {
  all: ["yearly"] as const,
  summary: (year: number) => [...yearlyKeys.all, year] as const,
};

type UseYearlySummaryOptions = {
  enabled?: boolean;
};

export function useYearlySummary(
  year: number,
  options: UseYearlySummaryOptions = {},
) {
  return useQuery({
    queryKey: yearlyKeys.summary(year),
    queryFn: () => getYearlySummary(year),
    staleTime: 1000 * 60 * 5,
    // Keep showing the previous period or page while the next one loads.
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
