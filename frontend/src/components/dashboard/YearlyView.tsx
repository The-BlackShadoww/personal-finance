"use client";

import { useMemo, useState } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { Legend } from "@/components/charts/core";
import { Reveal } from "@/components/motion/Reveal";
import { useYearlySummary } from "@/lib/hooks/useYearlySummary";
import { monthName, monthNameShort } from "@/lib/utils/format";
import { BreakdownTable } from "./BreakdownTable";
import { PeriodSummaryCards } from "./PeriodSummaryCards";
import { ErrorNote, Panel, PeriodStepper } from "./primitives";

const SERIES = [
  { key: "income", label: "Income", color: "var(--ds-series-income)" },
  { key: "expense", label: "Expenses", color: "var(--ds-series-expense)" },
];
const NET = { key: "net", label: "Net savings", color: "var(--ds-series-net)" };

export function YearlyView() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading, isPlaceholderData, error } = useYearlySummary(year);
  const { data: prior } = useYearlySummary(year - 1);
  // Skeletons only when nothing is cached; background refetches and period
  // changes keep the current numbers on screen (dimmed while stale).
  const loading = isLoading;
  const hasPriorYear = Boolean(
    prior?.monthlyBreakdown.some((row) => row.totalIncome !== 0 || row.totalExpense !== 0),
  );

  const chartData = useMemo(
    () =>
      (data?.monthlyBreakdown ?? [])
        // Months that have not happened yet would plot as a misleading drop to zero.
        .filter((row) => year < currentYear || row.month <= new Date().getMonth() + 1)
        .map((row) => ({
        label: monthNameShort(row.month),
        title: `${monthName(row.month)} ${year}`,
        values: { income: row.totalIncome, expense: row.totalExpense, net: row.savings },
      })),
    [currentYear, data, year],
  );

  return (
    <div className={`space-y-8 transition-opacity duration-150 ${isPlaceholderData ? "opacity-60" : ""}`} aria-busy={isPlaceholderData}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-[14px] text-muted">
          Review the full picture before planning what comes next.
        </p>
        <PeriodStepper
          label={String(year)}
          onPrevious={() => setYear((value) => value - 1)}
          onNext={() => setYear((value) => Math.min(currentYear, value + 1))}
          canGoNext={year < currentYear}
          previousLabel="Previous year"
          nextLabel="Next year"
        />
      </div>

      {error ? <ErrorNote>Your yearly summary could not load. Try again in a moment.</ErrorNote> : null}

      <PeriodSummaryCards
        totalIncome={data?.totalIncome ?? 0}
        totalExpense={data?.totalExpense ?? 0}
        savings={data?.savings ?? 0}
        savingsRate={String(data?.savingsRate ?? "0.0")}
        isLoading={loading}
        against={String(year - 1)}
        previous={
          hasPriorYear && prior
            ? {
                totalIncome: prior.totalIncome,
                totalExpense: prior.totalExpense,
                savings: prior.savings,
                savingsRate: Number(prior.savingsRate) || 0,
              }
            : null
        }
        trends={
          data
            ? {
                income: data.monthlyBreakdown.map((row) => row.totalIncome),
                expense: data.monthlyBreakdown.map((row) => row.totalExpense),
                savings: data.monthlyBreakdown.map((row) => row.savings),
              }
            : undefined
        }
      />

      <Reveal>
        <Panel
          title={`Cash flow across ${year}`}
          subtitle="Monthly income and expenses, with net savings traced on top"
          action={<Legend series={[...SERIES, NET]} />}
        >
          {loading ? (
            <div className="skeleton h-[320px]" />
          ) : (
            <BarChart
              data={chartData}
              series={SERIES}
              line={NET}
              height={320}
              ariaLabel={`Monthly income, expenses and net savings for ${year}`}
            />
          )}
        </Panel>
      </Reveal>

      <Reveal>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[15px] text-foreground">Monthly detail</h3>
            <p className="text-[13px] text-muted">Compare each month to understand the year’s rhythm.</p>
          </div>
          {!loading && data ? (
            <p className="num text-[12px] text-muted">
              {data.transactionCount?.toLocaleString() ?? 0} transactions in {year}
            </p>
          ) : null}
        </div>
        <BreakdownTable
          rows={data?.monthlyBreakdown ?? []}
          year={year}
          comparisonRows={hasPriorYear ? prior?.monthlyBreakdown : undefined}
          comparisonYear={year - 1}
          isLoading={loading}
        />
      </Reveal>
    </div>
  );
}
