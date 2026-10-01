"use client";

import Link from "next/link";
import { Panel } from "@/components/dashboard/primitives";
import { Stat } from "@/components/wealth/Stat";
import type { IncomeKind, WealthOverview } from "@/lib/api/wealth";
import { formatCents } from "@/lib/utils/money";

const KINDS: Array<{ kind: IncomeKind; label: string; color: string }> = [
  { kind: "active", label: "Active (work)", color: "var(--ds-series-income)" },
  { kind: "passive", label: "Passive", color: "var(--ds-series-net)" },
  { kind: "portfolio", label: "Investments", color: "#4a3aa7" },
  { kind: "unclassified", label: "Not classified", color: "var(--ds-faint)" },
];

/** Where income comes from and how it is growing (W8). */
export function IncomePanel({ data }: { data: WealthOverview }) {
  const { income } = data;

  if (income.last12Cents === 0) {
    return (
      <Panel title="Income" subtitle="The last 12 months">
        <p className="text-[14px] text-muted">No income recorded in the last 12 months.</p>
      </Panel>
    );
  }

  const growth = income.yearOverYearGrowth;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Income, last 12 months" value={formatCents(income.last12Cents, 0)} />
        <Stat
          label="Growth vs the year before"
          value={growth === null ? "—" : `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`}
          note={growth === null ? "Needs two years of history" : "Save at least half of any raise"}
        />
        <Stat label="Regular sources" value={String(income.activeSourceCount)} note="paid in 3 of the last 6 months" />
        <Stat
          label="Passive coverage"
          value={income.passiveCoverage === null ? "—" : `${income.passiveCoverage.toFixed(1)}%`}
          note="of spending paid by passive and investment income"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-5" title="By kind" subtitle="Active income needs your time; passive and investment income don't">
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
            {KINDS.map(({ kind, color }) =>
              income.byKind[kind] > 0 ? (
                <div key={kind} style={{ width: `${(income.byKind[kind] / income.last12Cents) * 100}%`, backgroundColor: color }} />
              ) : null,
            )}
          </div>
          <ul className="mt-5 space-y-2 text-[13px]">
            {KINDS.filter(({ kind }) => income.byKind[kind] > 0).map(({ kind, label, color }) => (
              <li key={kind} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  {label}
                </span>
                <span className="num text-muted">
                  <span className="text-foreground">{formatCents(income.byKind[kind], 0)}</span> ·{" "}
                  {((income.byKind[kind] / income.last12Cents) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
          {income.byKind.unclassified > 0 ? (
            <p className="mt-4 text-[12px] text-muted">
              Mark income categories as active, passive or investment in{" "}
              <Link href="/settings?tab=categories" className="underline underline-offset-2">
                Settings
              </Link>
              .
            </p>
          ) : null}
        </Panel>

        <Panel className="lg:col-span-7" title="Sources" subtitle="Each income category, largest first">
          <ul className="divide-y divide-line">
            {income.sources.map((source) => (
              <li key={source.categoryId} className="flex items-center gap-4 py-2.5 text-[13px] first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{source.name}</p>
                  <p className="text-[12px] text-muted">paid in {source.monthsPaid} of the last 6 months</p>
                </div>
                <p className="num shrink-0 text-right">
                  {formatCents(source.last12Cents, 0)}
                  <span className="block text-[12px] text-muted">{source.share.toFixed(0)}%</span>
                </p>
              </li>
            ))}
          </ul>
          {income.concentrated && income.largestSource ? (
            <p className="mt-5 rounded-[8px] bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
              <span className="text-foreground">{income.largestSource.name}</span> is {income.largestSource.share.toFixed(0)}%
              of your income. A second source — even a small one — makes losing the main one less of a shock, and is another
              reason to keep the emergency fund full.
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
