import { useQuery, useQueryClient } from "@tanstack/react-query";

import { calculationsApi } from "@/lib/api/calculations";
import { accountKeys } from "@/lib/hooks/useAccount";
import { yearlyKeys } from "@/lib/hooks/useYearlySummary";

export const dashboardKeys = {
  overview: (year: number, month: number) =>
    ["calculations", "dashboard", year, month] as const,
};

/**
 * Loads the monthly dashboard in a single request. The response also fills
 * the caches of the per-resource queries it contains (yearly summary, account
 * summary, ...) so other views that need them render without refetching.
 */
export function useDashboardOverview(year: number, month: number) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: dashboardKeys.overview(year, month),
    queryFn: async () => {
      const overview = await calculationsApi.getDashboardOverview(year, month);

      queryClient.setQueryData(["calculations", "monthly", year, month], overview.monthly);
      queryClient.setQueryData(
        ["calculations", "category-breakdown", year, month],
        overview.categoryBreakdown,
      );
      queryClient.setQueryData(yearlyKeys.summary(year), overview.yearly);
      if (overview.previousYearly) {
        queryClient.setQueryData(yearlyKeys.summary(year - 1), overview.previousYearly);
      }
      queryClient.setQueryData(accountKeys.summary(), overview.account);

      return overview;
    },
    staleTime: 60 * 1000,
  });
}
