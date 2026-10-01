"use client";

import Link from "next/link";
import { Panel } from "@/components/dashboard/primitives";
import { formatDay } from "@/components/recurring/RecurringPanel";
import { useRecurring } from "@/lib/hooks/useRecurring";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

const SHOWN = 6;

/** The coming month of recurring income, bills and transfers. */
export function UpcomingPanel() {
  const { data, isLoading } = useRecurring();
  const upcoming = data?.upcoming.slice(0, SHOWN) ?? [];
  const dueCount = data?.due.length ?? 0;

  return (
    <Panel title="Coming up" subtitle="The coming month of salary, bills and transfers">
      {isLoading ? (
        <div className="skeleton h-40" />
      ) : (
        <div className="space-y-4">
          {dueCount ? (
            <Link
              href="/transactions?tab=recurring"
              className="block rounded-[8px] bg-yellow-bg px-4 py-3 text-[13px] text-yellow-fg underline-offset-4 hover:underline"
            >
              {dueCount} {dueCount === 1 ? "entry is" : "entries are"} due — confirm or skip
            </Link>
          ) : null}
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((item) => (
                <li key={`${item.ruleId}-${item.date}`} className="flex items-center gap-4 py-2.5 text-[13px]">
                  <span className="num w-14 shrink-0 text-muted">{formatDay(item.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span
                    className={cn(
                      "num shrink-0",
                      item.type === "income" ? "text-income" : item.type === "expense" ? "text-foreground" : "text-muted",
                    )}
                  >
                    {item.type === "income" ? "+" : item.type === "expense" ? "-" : ""}
                    {formatCents(item.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">
              Nothing scheduled.{" "}
              <Link href="/transactions?tab=recurring" className="text-foreground underline underline-offset-4">
                Set up salary and bills
              </Link>{" "}
              so payday saving happens on its own.
            </p>
          )}
          {upcoming.length ? (
            <Link href="/transactions?tab=recurring" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
              All recurring
            </Link>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
