"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { AccountSummary } from "@/lib/api/account";
import { cn } from "@/lib/utils/cn";
import { formatMoneyAbs } from "@/lib/utils/money";

export function SectorsBreakdown({ summary }: { summary: AccountSummary }) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const segments = [
    ...summary.sectors,
    {
      ...summary.cash,
      id: "cash",
      targetAmountCents: null as number | null,
      progressPercent: null as number | null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[3px]" aria-hidden="true">
        {segments.map((s, index) => (
          <motion.div
            key={s.id}
            className="h-full first:rounded-l-[3px] last:rounded-r-[3px]"
            style={{ backgroundColor: s.color, originX: 0 }}
            initial={reduceMotion ? false : { scaleX: 0, width: `${Math.max(0, s.percentage)}%` }}
            animate={{
              scaleX: 1,
              width: `${Math.max(0, s.percentage)}%`,
              opacity: hovered && hovered !== s.id ? 0.3 : 1,
            }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
            title={`${s.name}: ${s.percentage}%`}
          />
        ))}
      </div>

      <ul className="divide-y divide-line">
        {segments.map((s) => (
          <li
            key={s.id}
            onPointerEnter={() => setHovered(s.id)}
            onPointerLeave={() => setHovered(null)}
            className={cn("py-2.5 transition-opacity", hovered && hovered !== s.id && "opacity-50")}
          >
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="flex min-w-0 items-center gap-2.5 text-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.name}</span>
                <span className="num text-muted">{s.percentage}%</span>
              </span>
              <span className="num text-foreground">{formatMoneyAbs(s.allocatedCents / 100)}</span>
            </div>
            {s.targetAmountCents !== null ? (
              <div className="mt-2 flex items-center gap-3 pl-[18px]">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.color, originX: 0 }}
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: Math.min(100, s.progressPercent ?? 0) / 100 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  />
                </div>
                <span className="num text-[11px] text-muted">
                  {Math.round(s.progressPercent ?? 0)}% of {formatMoneyAbs(s.targetAmountCents / 100)}
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
