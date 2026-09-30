import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { calculationsApi } from "@/lib/api/calculations";
import { accountKeys } from "@/lib/hooks/useAccount";
import { yearlyKeys } from "@/lib/hooks/useYearlySummary";

export const dashboardKeys = {
  overview: (year: number, month: number) =>
    ["calculations", "dashboard", year, month] as const,
};

const OVERVIEW_STALE_TIME = 60 * 1000;

/**
 * Loads the monthly dashboard in a single request. The response also fills
 * the caches of the per-resource queries it contains (yearly summary, account
 * summary, ...) so other views that need them render without refetching.
 */
async function fetchDashboardOverview(queryClient: QueryClient, year: number, month: number) {
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
}

export function useDashboardOverview(year: number, month: number) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: dashboardKeys.overview(year, month),
    queryFn: () => fetchDashboardOverview(queryClient, year, month),
    staleTime: OVERVIEW_STALE_TIME,
    // Keep showing the previous period or page while the next one loads.
    placeholderData: keepPreviousData,
  });
}

/** Warms the cache for a month the user is likely to open next. No-op if it is already fresh. */
export function prefetchDashboardOverview(queryClient: QueryClient, year: number, month: number) {
  return queryClient.prefetchQuery({
    queryKey: dashboardKeys.overview(year, month),
    queryFn: () => fetchDashboardOverview(queryClient, year, month),
    staleTime: OVERVIEW_STALE_TIME,
  });
}
