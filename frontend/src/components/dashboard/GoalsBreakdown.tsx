"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { CategoryIcon } from "@/components/categories/IconPicker";
import type { EarmarkSummary } from "@/lib/api/account";
import { formatCents } from "@/lib/utils/money";

/** Compact list of goals for the dashboard balance card. */
export function GoalsBreakdown({ goals }: { goals: EarmarkSummary[] }) {
  const reduceMotion = useReducedMotion();

  if (!goals.length) {
    return (
      <p className="text-[13px] text-muted">
        No goals yet. <Link href="/goals" className="text-foreground underline underline-offset-4">Set one up</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line">
        {goals.map((goal) => {
          const percent =
            goal.targetAmountCents && goal.targetAmountCents > 0
              ? Math.min(100, Math.round((goal.balanceCents / goal.targetAmountCents) * 100))
              : null;
          return (
            <li key={goal.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2.5 text-foreground">
                  <span style={{ color: goal.color }}>
                    <CategoryIcon name={goal.icon} size={13} />
                  </span>
                  <span className="truncate">{goal.name}</span>
                </span>
                <span className="num text-foreground">{formatCents(goal.balanceCents)}</span>
              </div>
              {percent !== null ? (
                <div className="mt-2 flex items-center gap-3 pl-[22px]">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: goal.color, originX: 0 }}
                      initial={reduceMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: percent / 100 }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    />
                  </div>
                  <span className="num text-[11px] text-muted">
                    {percent}% of {formatCents(goal.targetAmountCents!, 0)}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Link href="/goals" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
        Open goals
      </Link>
    </div>
  );
}
