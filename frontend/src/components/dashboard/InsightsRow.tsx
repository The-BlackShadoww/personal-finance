"use client";

import Link from "next/link";
import { StatTile } from "@/components/dashboard/primitives";
import { NextActionCard } from "@/components/insights/NextActionCard";
import { HEALTH_BANDS, type DashboardInsights } from "@/lib/api/insights";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";

/**
 * Today's coaching beside the month's numbers: the next best step, net
 * worth, runway and the health score. Always "now", whichever month the
 * dashboard shows.
 */
export function InsightsRow({ insights, isLoading }: { insights: DashboardInsights | undefined; isLoading: boolean }) {
  const runway = insights?.runway;
  const health = insights?.health;

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <NextActionCard className="lg:col-span-5" action={insights?.nextAction} isLoading={isLoading} />
      <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
        <StatTile
          label="Net worth"
          value={(insights?.netWorth.currentCents ?? 0) / 100}
          format={(value) => formatMoney(value, 0)}
          isLoading={isLoading}
          trend={insights?.netWorth.trend}
          trendColor="var(--ds-series-net)"
          delta={
            insights?.netWorth.changeSixMonthsCents != null
              ? {
                  value: insights.netWorth.changeSixMonthsCents / 100,
                  upIsGood: true,
                  against: "6 months ago",
                  format: (value) => formatMoney(value, 0),
                }
              : null
          }
        />
        <LinkTile
          label="Runway"
          isLoading={isLoading}
          value={runway?.fullMonths != null ? runway.fullMonths.toFixed(1) : null}
          unit="months"
          note={
            runway?.essentialMonths != null
              ? `${runway.essentialMonths.toFixed(1)} on essentials only`
              : "Needs recorded spending"
          }
        />
        <LinkTile
          label="Health score"
          isLoading={isLoading}
          value={health?.score != null ? String(health.score) : null}
          unit="/ 100"
          note={health?.score != null ? "See what makes it up" : "Needs a few months of history"}
          tag={health?.band ? HEALTH_BANDS[health.band] : undefined}
        />
      </div>
    </div>
  );
}

function LinkTile({
  label,
  value,
  unit,
  note,
  tag,
  isLoading,
}: {
  label: string;
  value: string | null;
  unit: string;
  note: string;
  tag?: { label: string; className: string };
  isLoading: boolean;
}) {
  return (
    <Link
      href="/insights"
      className="card card-hover flex min-h-[152px] flex-col justify-between p-6 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-muted">{label}</p>
        {tag && !isLoading ? <span className={cn("tag", tag.className)}>{tag.label}</span> : null}
      </div>
      {isLoading ? (
        <div className="space-y-2.5">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-3.5 w-28" />
        </div>
      ) : (
        <div>
          <p className="num text-[28px] leading-none tracking-[-0.03em] text-foreground md:text-[30px]">
            {value ?? "—"} {value !== null ? <span className="text-[15px] text-muted">{unit}</span> : null}
          </p>
          <p className="mt-2.5 text-[12px] text-muted">{note}</p>
        </div>
      )}
    </Link>
  );
}
