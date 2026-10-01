"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AreaChart } from "@/components/charts/AreaChart";
import { ChartEmpty, Legend } from "@/components/charts/core";
import { ErrorNote, Panel, StatTile } from "@/components/dashboard/primitives";
import { ReviewLink } from "@/components/habits/HabitPrompts";
import { HealthBreakdown } from "@/components/insights/HealthBreakdown";
import { NextActionCard } from "@/components/insights/NextActionCard";
import { SpendingInsightList } from "@/components/insights/SpendingInsightList";
import { ValuationPrompts } from "@/components/insights/ValuationPrompts";
import { PageHeader } from "@/components/layouts/PageHeader";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { HEALTH_BANDS, type InsightsOverview } from "@/lib/api/insights";
import { DebtPlanner } from "@/components/wealth/DebtPlanner";
import { FiCalculator } from "@/components/wealth/FiCalculator";
import { IncomePanel } from "@/components/wealth/IncomePanel";
import { InvestmentsPanel } from "@/components/wealth/InvestmentsPanel";
import { useInsights } from "@/lib/hooks/useInsights";
import { useWealth } from "@/lib/hooks/useWealth";
import { cn } from "@/lib/utils/cn";
import { formatCents, formatMoney } from "@/lib/utils/money";

type Range = "12" | "24" | "60";

const monthLabel = (month: string, style: "short" | "long") => {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleString("en-US", style === "short" ? { month: "short" } : { month: "long", year: "numeric" });
};

type Tab = "health" | "debt" | "fi" | "investments" | "income";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "health", label: "Health" },
  { value: "debt", label: "Debt" },
  { value: "fi", label: "Independence" },
  { value: "investments", label: "Investments" },
  { value: "income", label: "Income" },
];

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-[480px]" />}>
      <InsightsContent />
    </Suspense>
  );
}

function InsightsContent() {
  // The active tab lives in the URL so links (e.g. the next best action) can target it.
  const searchParams = useSearchParams();
  const router = useRouter();
  const requested = searchParams.get("tab");
  const tab = TABS.find((option) => option.value === requested)?.value ?? "health";

  function selectTab(next: Tab) {
    router.replace(`/insights?tab=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Insights"
        title="How your money is doing."
        aside="One score, one next step, and the tools to plan the rest."
        actions={<SegmentedControl label="Insights section" value={tab} onChange={selectTab} options={TABS} />}
      />
      {tab === "health" ? <HealthTab /> : <WealthTab tab={tab} />}

      <p className="border-t border-line pt-6 text-[12px] leading-relaxed text-faint">
        Educational guidance based on widely used personal-finance rules. Not individual investment, tax or legal advice.
        Ratios use the take-home income you record, which makes every target stricter than the usual gross-income rules.
      </p>
    </div>
  );
}

/** Debt, FI, investments and income share one request. */
function WealthTab({ tab }: { tab: Exclude<Tab, "health"> }) {
  const { data, isLoading, isError, error } = useWealth();
  if (isError) return <ErrorNote>{error instanceof Error ? error.message : "Could not load your data."}</ErrorNote>;
  if (isLoading || !data) return <div className="skeleton h-[480px]" />;
  if (tab === "debt") return <DebtPlanner data={data} />;
  if (tab === "fi") return <FiCalculator data={data} />;
  if (tab === "investments") return <InvestmentsPanel data={data} />;
  return <IncomePanel data={data} />;
}

function HealthTab() {
  const [range, setRange] = useState<Range>("24");
  const { data, isLoading, isError, error, isPlaceholderData } = useInsights(Number(range));

  return (
    <div className="space-y-10">
      {isError ? <ErrorNote>{error instanceof Error ? error.message : "Could not load insights."}</ErrorNote> : null}
      <ReviewLink />

      <Stagger className="grid gap-3 lg:grid-cols-12">
        <StaggerItem className="lg:col-span-5">
          <HealthScoreCard overview={data} isLoading={isLoading} />
        </StaggerItem>
        <StaggerItem className="lg:col-span-7">
          <NextActionCard className="h-full" action={data?.nextAction} isLoading={isLoading} />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Net worth"
          value={(data?.netWorth.currentCents ?? 0) / 100}
          format={(value) => formatMoney(value, 0)}
          isLoading={isLoading}
          trend={data?.netWorth.series.slice(-7).map((point) => point.netWorthCents)}
          trendColor="var(--ds-series-net)"
          delta={
            data?.netWorth.changeSixMonthsCents != null
              ? {
                  value: data.netWorth.changeSixMonthsCents / 100,
                  upIsGood: true,
                  against: "six months ago",
                  format: (value) => formatMoney(value, 0),
                }
              : null
          }
        />
        <RunwayTile overview={data} isLoading={isLoading} />
        <RatesTile overview={data} isLoading={isLoading} />
      </div>

      <Reveal>
        <Panel
          title="Net worth"
          subtitle="What you own minus what you owe, at the end of each month"
          action={
            <SegmentedControl
              label="Net worth range"
              value={range}
              onChange={setRange}
              options={[
                { value: "12", label: "1 year" },
                { value: "24", label: "2 years" },
                { value: "60", label: "5 years" },
              ]}
            />
          }
        >
          <div className={cn("transition-opacity duration-150", isPlaceholderData && "opacity-60")}>
            <NetWorthChart overview={data} isLoading={isLoading} />
          </div>
          {data?.valuationPrompts.length ? (
            <div className="mt-6">
              <ValuationPrompts prompts={data.valuationPrompts} />
            </div>
          ) : null}
        </Panel>
      </Reveal>

      <div className="grid gap-3 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Panel
            title="What makes up the score"
            subtitle="Each measure scores 0–100 between a weak and a healthy level, then counts by its weight"
            className="h-full"
          >
            {isLoading || !data ? <div className="skeleton h-[420px]" /> : <HealthBreakdown metrics={data.health.metrics} />}
          </Panel>
        </Reveal>
        <Reveal className="lg:col-span-5" delay={0.06}>
          <Panel title="Worth a look" subtitle="Unusual spending in recent months" className="h-full">
            {isLoading || !data ? <div className="skeleton h-40" /> : <SpendingInsightList insights={data.insights} />}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

function HealthScoreCard({ overview, isLoading }: { overview: InsightsOverview | undefined; isLoading: boolean }) {
  if (isLoading || !overview) {
    return (
      <div className="card-muted h-full space-y-5 p-7 md:p-8">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-16 w-40" />
        <div className="skeleton h-4 w-56" />
      </div>
    );
  }

  const { score, band, metrics } = overview.health;
  const measured = metrics.filter((metric) => metric.available).length;

  return (
    <section className="card-muted relative flex h-full flex-col overflow-clip p-7 md:p-8">
      <div
        className="dot-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]"
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-2.5">
        <p className="eyebrow">Financial health</p>
        {band ? <span className={cn("tag", HEALTH_BANDS[band].className)}>{HEALTH_BANDS[band].label}</span> : null}
      </div>
      {score === null ? (
        <p className="relative mt-5 text-[20px] text-muted">Not enough data yet.</p>
      ) : (
        <p className="relative mt-5 flex items-baseline gap-2">
          <AnimatedNumber
            value={score}
            format={(value) => Math.round(value).toString()}
            duration={0.7}
            className="num text-[64px] font-[360] leading-none tracking-[-0.045em] text-foreground md:text-[72px]"
          />
          <span className="num text-[18px] text-muted">/ 100</span>
        </p>
      )}
      <p className="relative mt-auto pt-6 text-[13px] text-muted">
        From {measured} of {metrics.length} measures
        {measured < metrics.length ? "; the rest need more history or profile answers" : ""}.{" "}
        {overview.hasHistory ? null : (
          <>
            <Link href="/transactions" className="text-foreground underline underline-offset-4">
              Record income and spending
            </Link>{" "}
            to unlock the rest.
          </>
        )}
      </p>
    </section>
  );
}

function RunwayTile({ overview, isLoading }: { overview: InsightsOverview | undefined; isLoading: boolean }) {
  const runway = overview?.runway;
  return (
    <article className="card card-hover flex min-h-[152px] flex-col justify-between p-6">
      <p className="text-[13px] text-muted">Runway</p>
      {isLoading || !runway ? (
        <div className="space-y-2.5">
          <div className="skeleton h-8 w-36" />
          <div className="skeleton h-3.5 w-24" />
        </div>
      ) : runway.fullMonths === null ? (
        <p className="text-[13px] text-muted">Shows once you have recorded some spending.</p>
      ) : (
        <div>
          <p className="num text-[28px] leading-none tracking-[-0.03em] md:text-[30px]">
            {runway.fullMonths.toFixed(1)} <span className="text-[15px] text-muted">months</span>
          </p>
          <p className="mt-2.5 text-[12px] text-muted">
            at your current lifestyle
            {runway.essentialMonths !== null ? (
              <>
                , <span className="num text-foreground">{runway.essentialMonths.toFixed(1)}</span> on essentials only
              </>
            ) : null}
            .
          </p>
        </div>
      )}
    </article>
  );
}

function RatesTile({ overview, isLoading }: { overview: InsightsOverview | undefined; isLoading: boolean }) {
  const rates = overview?.rates;
  const rate = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);
  return (
    <article className="card card-hover flex min-h-[152px] flex-col justify-between p-6">
      <p className="text-[13px] text-muted">Last three months</p>
      {isLoading || !rates ? (
        <div className="space-y-2.5">
          <div className="skeleton h-8 w-36" />
          <div className="skeleton h-3.5 w-24" />
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[12px] text-muted">Saved</dt>
            <dd className="num mt-1 text-[24px] leading-none tracking-[-0.03em]">{rate(rates.savingsRate)}</dd>
            <dd className="mt-1.5 text-[11px] text-faint">target 20%</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Invested</dt>
            <dd className="num mt-1 text-[24px] leading-none tracking-[-0.03em]">{rate(rates.investingRate)}</dd>
            <dd className="mt-1.5 text-[11px] text-faint">target 15%</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

function NetWorthChart({ overview, isLoading }: { overview: InsightsOverview | undefined; isLoading: boolean }) {
  const points = useMemo(
    () =>
      (overview?.netWorth.series ?? []).map((point) => ({
        label: monthLabel(point.month, "short"),
        title: monthLabel(point.month, "long"),
        values: { netWorth: point.netWorthCents / 100, liabilities: point.liabilitiesCents / 100 },
      })),
    [overview],
  );

  if (isLoading || !overview) return <div className="skeleton h-[300px]" />;

  const hasDebt = overview.netWorth.series.some((point) => point.liabilitiesCents > 0);
  const series = [
    { key: "netWorth", label: "Net worth", color: "var(--ds-series-net)" },
    ...(hasDebt ? [{ key: "liabilities", label: "Owed", color: "var(--ds-series-expense)" }] : []),
  ];
  const flat = overview.netWorth.series.every((point) => point.netWorthCents === 0);

  return flat ? (
    <ChartEmpty height={300} message="Add your accounts and their balances to see net worth over time." />
  ) : (
    <>
      {hasDebt ? <Legend series={series} className="mb-4" /> : null}
      <AreaChart
        data={points}
        series={series}
        height={300}
        formatValue={(value) => formatMoney(value, 0)}
        ariaLabel={`Net worth at the end of each month, now ${formatCents(overview.netWorth.currentCents, 0)}`}
      />
    </>
  );
}
