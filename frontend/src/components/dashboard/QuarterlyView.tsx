"use client";

import { useMemo, useState } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { Legend } from "@/components/charts/core";
import { Reveal } from "@/components/motion/Reveal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useQuarterlySummary } from "@/lib/hooks/useQuarterlySummary";
import { monthName, monthNameShort } from "@/lib/utils/format";

import { BreakdownTable } from "./BreakdownTable";
import { PeriodSummaryCards } from "./PeriodSummaryCards";
import { ErrorNote, Panel, PeriodStepper } from "./primitives";

const QUARTERS = [
  { q: 1, label: "Q1", months: "Jan – Mar" },
  { q: 2, label: "Q2", months: "Apr – Jun" },
  { q: 3, label: "Q3", months: "Jul – Sep" },
  { q: 4, label: "Q4", months: "Oct – Dec" },
] as const;

const SERIES = [
  { key: "income", label: "Income", color: "var(--ds-series-income)" },
  { key: "expense", label: "Expenses", color: "var(--ds-series-expense)" },
];
const NET = { key: "net", label: "Net savings", color: "var(--ds-series-net)" };

function getCurrentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

export function QuarterlyView() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = getCurrentQuarter();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(currentQuarter);

  const { data: summary, isLoading, isPlaceholderData, error } = useQuarterlySummary(selectedYear, selectedQuarter);
  const previousQuarter = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
  const previousYear = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
  const { data: previousSummary } = useQuarterlySummary(previousYear, previousQuarter);

  const selectedQuarterMeta = QUARTERS.find((quarter) => quarter.q === selectedQuarter) ?? QUARTERS[0];
  const isCurrentQuarter = selectedYear === currentYear && selectedQuarter === currentQuarter;
  // Skeletons only when nothing is cached; background refetches and period
  // changes keep the current numbers on screen (dimmed while stale).
  const loading = isLoading;

  function goToPreviousQuarter() {
    if (selectedQuarter > 1) {
      setSelectedQuarter(selectedQuarter - 1);
    } else {
      setSelectedYear((year) => year - 1);
      setSelectedQuarter(4);
    }
  }

  function goToNextQuarter() {
    if (isCurrentQuarter) return;
    if (selectedQuarter < 4) {
      setSelectedQuarter(selectedQuarter + 1);
    } else {
      setSelectedYear((year) => year + 1);
      setSelectedQuarter(1);
    }
  }

  const chartData = useMemo(
    () =>
      (summary?.monthlyBreakdown ?? []).map((row) => ({
        label: monthNameShort(row.month),
        title: `${monthName(row.month)} ${selectedYear}`,
        values: { income: row.totalIncome, expense: row.totalExpense, net: row.savings },
      })),
    [selectedYear, summary],
  );

  return (
    <div className={`space-y-8 transition-opacity duration-150 ${isPlaceholderData ? "opacity-60" : ""}`} aria-busy={isPlaceholderData}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label="Quarter"
          value={String(selectedQuarter)}
          onChange={(value) => setSelectedQuarter(Number(value))}
          options={QUARTERS.map(({ q, label, months }) => {
            const isFutureQuarter = selectedYear === currentYear && q > currentQuarter;
            return {
              value: String(q),
              label: (
                <>
                  {label}
                  <span className="hidden text-[12px] text-faint sm:inline">{months.replace(" – ", "–")}</span>
                </>
              ),
              disabled: isFutureQuarter,
              title: isFutureQuarter ? "Cannot navigate to a future quarter" : months,
            };
          })}
        />
        <PeriodStepper
          label={`${selectedQuarterMeta.label} ${selectedYear}`}
          onPrevious={goToPreviousQuarter}
          onNext={goToNextQuarter}
          canGoNext={!isCurrentQuarter}
          previousLabel="Previous quarter"
          nextLabel="Next quarter"
        />
      </div>

      {error ? <ErrorNote>Failed to load quarterly data. Please try again.</ErrorNote> : null}

      <PeriodSummaryCards
        totalIncome={summary?.totalIncome ?? 0}
        totalExpense={summary?.totalExpense ?? 0}
        savings={summary?.savings ?? 0}
        savingsRate={summary?.savingsRate ?? "0.0"}
        isLoading={loading}
        against={`Q${previousQuarter}`}
        previous={
          previousSummary
            ? {
                totalIncome: previousSummary.totalIncome,
                totalExpense: previousSummary.totalExpense,
                savings: previousSummary.savings,
                savingsRate: Number(previousSummary.savingsRate) || 0,
              }
            : null
        }
      />

      <Reveal>
        <Panel
          title={`${selectedQuarterMeta.label} ${selectedYear} month by month`}
          subtitle={`${selectedQuarterMeta.months} ${selectedYear}`}
          action={<Legend series={[...SERIES, NET]} />}
        >
          {loading ? (
            <div className="skeleton h-[300px]" />
          ) : (
            <BarChart
              data={chartData}
              series={SERIES}
              line={NET}
              height={300}
              maxBarWidth={28}
              ariaLabel={`Income, expenses and net savings for each month of ${selectedQuarterMeta.label} ${selectedYear}`}
            />
          )}
        </Panel>
      </Reveal>

      <Reveal>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-[15px] text-foreground">Monthly breakdown</h3>
            <p className="text-[13px] text-muted">Every month in the quarter, side by side.</p>
          </div>
        </div>
        <BreakdownTable rows={summary?.monthlyBreakdown ?? []} year={selectedYear} isLoading={loading} />
      </Reveal>
    </div>
  );
}
