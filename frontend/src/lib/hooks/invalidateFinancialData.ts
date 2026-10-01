import type { QueryClient } from "@tanstack/react-query";

import { accountKeys } from "@/lib/hooks/useAccount";
import { financialProfileKeys } from "@/lib/hooks/useFinancialProfile";
import { quarterlyKeys } from "@/lib/hooks/useQuarterlySummary";
import { yearlyKeys } from "@/lib/hooks/useYearlySummary";

/**
 * Marks every query derived from transactions as stale after a transaction
 * is created, updated or deleted. Only mounted queries refetch immediately;
 * the rest refetch the next time they are used.
 */
export function invalidateFinancialData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    // Monthly summary, category breakdown and the dashboard overview.
    queryClient.invalidateQueries({ queryKey: ["calculations"] }),
    queryClient.invalidateQueries({ queryKey: yearlyKeys.all }),
    queryClient.invalidateQueries({ queryKey: quarterlyKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["report-preview"] }),
    queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    // Account balances (key owned by useAccounts).
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    // Its income-stability assessment is computed from transactions.
    queryClient.invalidateQueries({ queryKey: financialProfileKeys.all }),
  ]);
}
