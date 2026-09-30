"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { ChartEmpty, Legend } from "@/components/charts/core";
import { DonutChart } from "@/components/charts/DonutChart";
import { Gauge } from "@/components/charts/Gauge";
import { AccountBalanceWidget } from "@/components/dashboard/AccountBalanceWidget";
import { PeriodSummaryCards } from "@/components/dashboard/PeriodSummaryCards";
import { Panel, PeriodStepper, usd, usd0 } from "@/components/dashboard/primitives";
import { QuarterlyView } from "@/components/dashboard/QuarterlyView";
import { YearlyView } from "@/components/dashboard/YearlyView";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { YearlySummary } from "@/lib/api/calculations";
import { useDashboardOverview } from "@/lib/hooks/useDashboardOverview";
import { useProfile } from "@/lib/hooks/useProfile";
import { cn } from "@/lib/utils/cn";

type Period = "monthly" | "quarterly" | "yearly";

const FALLBACK_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

export default function DashboardPage() {
  const [activePeriod, setActivePeriod] = useState<Period>("monthly");
  const reduceMotion = useReducedMotion();
  const { data: profile } = useProfile();
  const firstName = profile?.name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}.`}
        aside="Here is where your money stands."
        actions={
          <SegmentedControl
            label="Dashboard period"
            value={activePeriod}
            onChange={setActivePeriod}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activePeriod}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {activePeriod === "monthly" ? <MonthlyView /> : activePeriod === "quarterly" ? <QuarterlyView /> : <YearlyView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MonthlyView() {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  const overview = useDashboardOverview(year, month);
  const monthly = overview.data?.monthly;
  const yearly = overview.data?.yearly;
  const previousYearly = overview.data?.previousYearly ?? undefined;
  const categoryBreakdown = overview.data?.categoryBreakdown;

  const points = useMemo(
    () => buildTrailingMonths(selectedDate, 6, yearly, previousYearly),
    [previousYearly, selectedDate, yearly],
  );
  const previousPoint = points[points.length - 2];

  const categoryItems = useMemo(
    () =>
      (categoryBreakdown ?? [])
        .filter((item) => item.type === "expense" && item.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((item, index) => ({
          id: item.name,
          label: item.name,
          value: item.total,
          count: item.count,
          color: item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        })),
    [categoryBreakdown],
  );
  const topCategories = categoryItems.slice(0, 6);
  const categoryTotal = categoryItems.reduce((sum, item) => sum + item.value, 0);

  const loading = overview.isLoading;
  const trendLoading = overview.isLoading;
  const savingsRate = Number(monthly?.savingsRate ?? 0);
  const monthLabel = selectedDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const hasFlow = points.some((point) => point.values.income || point.values.expense);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">
          Showing <span className="text-foreground">{monthLabel}</span>
          {monthly ? (
            <span className="num"> · {monthly.transactionCount} transactions</span>
          ) : null}
        </p>
        <PeriodStepper
          label={monthLabel}
          onPrevious={() => setSelectedDate(new Date(year, month - 2, 1))}
          onNext={() => setSelectedDate(new Date(year, month, 1))}
          previousLabel="Previous month"
          nextLabel="Next month"
        />
      </div>

      <Stagger className="grid gap-3 lg:grid-cols-12">
        <StaggerItem className="lg:col-span-7">
          <AccountBalanceWidget className="h-full" summary={overview.data?.account} isLoading={overview.isLoading} />
        </StaggerItem>
        <StaggerItem className="lg:col-span-5">
          <section className="card card-hover flex h-full flex-col p-7 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[15px]">Savings rate</h2>
                <p className="text-[13px] text-muted">Share of income you kept</p>
              </div>
              {loading ? null : !(monthly?.totalIncome || monthly?.totalExpense) ? (
                <span className="tag bg-surface-2 text-muted">No activity</span>
              ) : (
                <span
                  className={cn(
                    "tag",
                    savingsRate >= 20
                      ? "bg-green-bg text-green-fg"
                      : savingsRate > 0
                        ? "bg-yellow-bg text-yellow-fg"
                        : "bg-red-bg text-red-fg",
                  )}
                >
                  {savingsRate >= 20 ? "On track" : savingsRate > 0 ? "Tight" : "Overspent"}
                </span>
              )}
            </div>
            <div className="flex flex-1 items-end justify-center pt-6">
              {loading ? <div className="skeleton h-[148px] w-[240px]" /> : <Gauge value={savingsRate} label={monthLabel} />}
            </div>
            <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
              Kept <span className="num text-foreground">{usd0(monthly?.savings ?? 0)}</span> of{" "}
              <span className="num text-foreground">{usd0(monthly?.totalIncome ?? 0)}</span> earned this month.
            </p>
          </section>
        </StaggerItem>
      </Stagger>

      <PeriodSummaryCards
        totalIncome={monthly?.totalIncome ?? 0}
        totalExpense={monthly?.totalExpense ?? 0}
        savings={monthly?.savings ?? 0}
        savingsRate={String(monthly?.savingsRate ?? "0")}
        isLoading={loading}
        against="last month"
        previous={
          previousPoint && !trendLoading && (previousPoint.values.income || previousPoint.values.expense)
            ? {
                totalIncome: previousPoint.values.income,
                totalExpense: previousPoint.values.expense,
                savings: previousPoint.values.income - previousPoint.values.expense,
                savingsRate: previousPoint.values.rate,
              }
            : null
        }
        trends={
          trendLoading
            ? undefined
            : {
                income: points.map((p) => p.values.income),
                expense: points.map((p) => p.values.expense),
                savings: points.map((p) => p.values.income - p.values.expense),
              }
        }
      />

      <Reveal>
        <Panel
          title="Cash flow"
          subtitle="Income and spending over the last six months"
          action={
            <Legend
              series={[
                { key: "income", label: "Income", color: "var(--ds-series-income)" },
                { key: "expense", label: "Expenses", color: "var(--ds-series-expense)" },
              ]}
            />
          }
        >
          {trendLoading ? (
            <div className="skeleton h-[300px]" />
          ) : hasFlow ? (
            <AreaChart
              data={points}
              height={300}
              series={[
                { key: "income", label: "Income", color: "var(--ds-series-income)" },
                { key: "expense", label: "Expenses", color: "var(--ds-series-expense)" },
              ]}
              formatValue={usd}
              ariaLabel={`Income and expenses for the six months ending ${monthLabel}`}
            />
          ) : (
            <ChartEmpty height={300} message="No income or spending recorded in the last six months." />
          )}
        </Panel>
      </Reveal>

      <div className="grid gap-3 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Panel title="Where it went" subtitle={`Expense categories in ${monthLabel}`} className="h-full">
            {overview.isLoading ? (
              <div className="skeleton h-[260px]" />
            ) : topCategories.length ? (
              <div className="grid items-center gap-8 md:grid-cols-[220px_1fr]">
                <DonutChart
                  slices={topCategories}
                  centerLabel="Spent"
                  formatValue={usd0}
                  activeId={activeCategory}
                  onActiveChange={setActiveCategory}
                  ariaLabel={`Spending by category for ${monthLabel}`}
                />
                <ul className="space-y-1">
                  {topCategories.map((item) => {
                    const share = categoryTotal ? (item.value / categoryTotal) * 100 : 0;
                    return (
                      <li
                        key={item.id}
                        onPointerEnter={() => setActiveCategory(item.id)}
                        onPointerLeave={() => setActiveCategory(null)}
                        className={cn(
                          "rounded-[8px] px-3 py-2 transition-[background-color,opacity] duration-200",
                          activeCategory === item.id && "bg-surface-2",
                          activeCategory && activeCategory !== item.id && "opacity-45",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="num shrink-0 text-muted">
                            <span className="text-foreground">{usd0(item.value)}</span> · {share.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: item.color, originX: 0 }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: share / 100 }}
                            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <ChartEmpty height={260} message="No spending recorded this month.">
                <Link href="/transactions" className={buttonClass({ size: "sm" })}>
                  <Plus size={13} weight="bold" /> Add a transaction
                </Link>
              </ChartEmpty>
            )}
          </Panel>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.08}>
          <Panel title="Savings momentum" subtitle="Monthly savings rate, last six months" className="h-full">
            {trendLoading ? (
              <div className="skeleton h-[260px]" />
            ) : (
              <BarChart
                data={points}
                series={[{ key: "rate", label: "Savings rate", color: "var(--ds-series-net)" }]}
                negativeColor="var(--ds-series-expense)"
                height={260}
                formatValue={(value) => `${value.toFixed(1)}%`}
                formatTick={(value) => `${value}%`}
                maxBarWidth={26}
                ariaLabel="Savings rate for each of the last six months"
              />
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function buildTrailingMonths(
  selectedDate: Date,
  count: number,
  currentYear?: YearlySummary,
  previousYear?: YearlySummary,
) {
  return Array.from({ length: count }, (_value, index) => {
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - (count - 1 - index), 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const summary =
      currentYear && year === Number(currentYear.year)
        ? currentYear
        : previousYear && year === Number(previousYear.year)
          ? previousYear
          : undefined;
    const row = summary?.monthlyBreakdown.find((item) => item.month === month);
    const income = row?.totalIncome ?? 0;
    const expense = row?.totalExpense ?? 0;
    return {
      label: date.toLocaleString("en-US", { month: "short" }),
      title: date.toLocaleString("en-US", { month: "long", year: "numeric" }),
      values: {
        income,
        expense,
        rate: income > 0 ? Number((((income - expense) / income) * 100).toFixed(1)) : 0,
      },
    };
  });
}
