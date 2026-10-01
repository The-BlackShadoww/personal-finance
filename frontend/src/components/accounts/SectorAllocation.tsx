"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { DonutChart } from "@/components/charts/DonutChart";
import { Panel } from "@/components/dashboard/primitives";
import { Reveal } from "@/components/motion/Reveal";
import type { AccountSummary } from "@/lib/api/account";
import { cn } from "@/lib/utils/cn";
import { formatMoneyAbs } from "@/lib/utils/money";

/**
 * Savings sectors: percentages of the available (liquid) balance earmarked
 * for goals, with Cash taking the remainder.
 */
export function SectorAllocation({ summary }: { summary: AccountSummary }) {
  const [active, setActive] = useState<string | null>(null);
  const allocations = [
    ...summary.sectors,
    {
      ...summary.cash,
      id: "cash",
      targetAmountCents: null as number | null,
      progressPercent: null as number | null,
    },
  ];
  const total = allocations.reduce((sum, item) => sum + item.allocatedCents, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Reveal className="lg:col-span-5">
        <Panel title="Allocation" subtitle="How your available balance is organized" className="h-full">
          {allocations.length ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-2">
              <DonutChart
                size={248}
                thickness={24}
                slices={allocations.map((item) => ({
                  id: item.id,
                  label: item.name,
                  value: item.allocatedCents / 100,
                  color: item.color,
                }))}
                centerLabel="Allocated"
                formatValue={(v) => formatMoneyAbs(v)}
                activeId={active}
                onActiveChange={setActive}
                ariaLabel="Balance allocation by sector"
              />
              <p className="num text-[13px] text-muted">{allocations.length} buckets · {formatMoneyAbs(total / 100)} total</p>
            </div>
          ) : (
            <div className="flex h-[270px] items-center justify-center text-[14px] text-muted">
              No allocations to show yet.
            </div>
          )}
        </Panel>
      </Reveal>

      <Reveal className="lg:col-span-7" delay={0.06}>
        <section className="card h-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5 md:px-7">
            <div>
              <h2 className="text-[15px]">Allocation details</h2>
              <p className="text-[13px] text-muted">Cash receives whatever the sectors leave.</p>
            </div>
            <Link href="/settings?tab=account" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
              Manage sectors
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {allocations.map((item, index) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                onPointerEnter={() => setActive(item.id)}
                onPointerLeave={() => setActive(null)}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 transition-[background-color,opacity] duration-200 md:px-7",
                  active === item.id && "bg-surface-2/70",
                  active && active !== item.id && "opacity-50",
                )}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
                  style={{ backgroundColor: `color-mix(in srgb, ${item.color} 14%, transparent)`, color: item.color }}
                >
                  <CategoryIcon name={item.icon} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[14px]">{item.name}</p>
                    <p className="num text-[14px]">{formatMoneyAbs(item.allocatedCents / 100)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color, originX: 0 }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: Math.max(0, item.percentage) / 100 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 + index * 0.05 }}
                      />
                    </div>
                    <span className="num w-10 text-right text-[12px] text-muted">{item.percentage}%</span>
                  </div>
                  {item.targetAmountCents !== null ? (
                    <p className="num mt-1.5 text-[12px] text-muted">
                      Goal {formatMoneyAbs(item.targetAmountCents / 100)} · {Math.round(item.progressPercent ?? 0)}% reached
                    </p>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
