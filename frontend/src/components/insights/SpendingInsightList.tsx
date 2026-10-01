"use client";

import { ArrowsClockwise, ChartLineUp, Lightning, TrendUp } from "@phosphor-icons/react";
import Link from "next/link";
import type { SpendingInsight } from "@/lib/api/insights";
import { formatCents } from "@/lib/utils/money";

const KIND_META: Record<SpendingInsight["kind"], { icon: typeof Lightning; amountLabel: string; suffix?: string }> = {
  category_drift: { icon: ChartLineUp, amountLabel: "over average" },
  unusual_transaction: { icon: Lightning, amountLabel: "above usual" },
  subscription: { icon: ArrowsClockwise, amountLabel: "a year" },
  lifestyle_creep: { icon: TrendUp, amountLabel: "more spending", suffix: "/mo" },
};

/** Up to three things worth a look in recent spending. */
export function SpendingInsightList({ insights }: { insights: SpendingInsight[] }) {
  if (!insights.length) {
    return <p className="text-[13px] text-muted">Nothing unusual in your recent spending.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {insights.map((insight) => {
        const meta = KIND_META[insight.kind];
        const Icon = meta.icon;
        return (
          <li key={`${insight.kind}-${insight.transactionId ?? insight.categoryId ?? ""}`} className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-surface-2 text-muted">
              <Icon size={14} weight="bold" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Link href={insight.href} className="text-[14px] text-foreground underline-offset-4 hover:underline">
                {insight.title}
              </Link>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{insight.detail}</p>
            </div>
            <p className="num shrink-0 text-right text-[13px]">
              {formatCents(insight.amountCents, 0)}
              {meta.suffix}
              <span className="block text-[11px] text-faint">{meta.amountLabel}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
