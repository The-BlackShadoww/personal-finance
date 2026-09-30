import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getQuarterlySummary } from "@/lib/api/calculations";

export const quarterlyKeys = {
  all: ["quarterly"] as const,
  summary: (year: number, quarter: number) =>
    [...quarterlyKeys.all, year, quarter] as const,
};

export function useQuarterlySummary(year: number, quarter: number) {
  return useQuery({
    queryKey: quarterlyKeys.summary(year, quarter),
    queryFn: () => getQuarterlySummary(year, quarter),
    staleTime: 1000 * 60 * 5,
    // Keep showing the previous period or page while the next one loads.
    placeholderData: keepPreviousData,
  });
}
