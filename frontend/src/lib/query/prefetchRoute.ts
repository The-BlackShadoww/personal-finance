import type { QueryClient } from "@tanstack/react-query";

import { accountSummaryQueryOptions } from "@/lib/hooks/useAccount";
import { accountsQueryOptions } from "@/lib/hooks/useAccounts";
import { categoriesQueryOptions } from "@/lib/hooks/useCategories";
import { prefetchDashboardOverview } from "@/lib/hooks/useDashboardOverview";
import { planQueryOptions } from "@/lib/hooks/useBudgets";
import { goalsQueryOptions } from "@/lib/hooks/useGoals";
import { reportPreviewQueryOptions } from "@/lib/hooks/useReportPreview";
import { transactionsQueryOptions } from "@/lib/hooks/useTransactions";

// Must match the transactions page's initial filters to share its cache entry.
const TRANSACTIONS_FIRST_PAGE = { page: 1, limit: 10 };

/**
 * Starts loading the data a route shows on first render, typically on nav
 * link hover/focus, so it is usually cached by the time the click lands.
 * Fresh cache entries are left alone, so repeated calls are cheap.
 */
export function prefetchRoute(queryClient: QueryClient, href: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  switch (href) {
    case "/dashboard":
      void prefetchDashboardOverview(queryClient, year, month);
      break;
    case "/accounts":
      void queryClient.prefetchQuery(accountsQueryOptions());
      void queryClient.prefetchQuery(accountSummaryQueryOptions());
      break;
    case "/budgets":
      void queryClient.prefetchQuery(planQueryOptions(year, month));
      break;
    case "/goals":
      void queryClient.prefetchQuery(goalsQueryOptions());
      void queryClient.prefetchQuery(accountsQueryOptions());
      break;
    case "/transactions":
      void queryClient.prefetchQuery(transactionsQueryOptions(TRANSACTIONS_FIRST_PAGE));
      void queryClient.prefetchQuery(accountsQueryOptions());
      void queryClient.prefetchQuery(categoriesQueryOptions());
      break;
    case "/reports":
      void queryClient.prefetchQuery(reportPreviewQueryOptions(year, month, year, month));
      break;
  }
}
