'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import { calculationsApi } from '../api/calculations';

export interface ReportPreviewData { totalIncome: number; totalExpense: number; savings: number; transactionCount: number; monthsIncluded: number; }

/** Shared by the hook and by route prefetching so both hit the same cache entry. */
export const reportPreviewQueryOptions = (startYear: number | null, startMonth: number | null, endYear: number | null, endMonth: number | null) => queryOptions({
  queryKey: ['report-preview', startYear, startMonth, endYear, endMonth],
  enabled: Boolean(startYear && startMonth && endYear && endMonth), staleTime: 1000 * 60 * 2,
  // One aggregated request for the whole range (previously one request per month).
  queryFn: async (): Promise<ReportPreviewData> => {
    const summary = await calculationsApi.getRangeSummary({ startYear: startYear!, startMonth: startMonth!, endYear: endYear!, endMonth: endMonth! });
    return { totalIncome: summary.totalIncome, totalExpense: summary.totalExpense, savings: summary.savings, transactionCount: summary.transactionCount, monthsIncluded: summary.monthsIncluded };
  },
});

export function useReportPreview(startYear: number | null, startMonth: number | null, endYear: number | null, endMonth: number | null) {
  return useQuery(reportPreviewQueryOptions(startYear, startMonth, endYear, endMonth));
}
