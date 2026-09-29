"use client";

import { ArrowDownLeft, ArrowUpRight, GearSix } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { DonutChart } from "@/components/charts/DonutChart";
import { Panel } from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/layouts/PageHeader";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { useAccountSummary } from "@/lib/hooks/useAccount";
import { cn } from "@/lib/utils/cn";
import { formatDollar } from "@/lib/utils/format";

export default function AccountPage() {
  const { data: summary, isLoading } = useAccountSummary();
  const [active, setActive] = useState<string | null>(null);

  const allocations = summary
    ? [
        ...summary.sectors,
        {
          ...summary.cash,
          id: "cash",
          targetAmountCents: null as number | null,
          progressPercent: null as number | null,
        },
      ]
    : [];
  const total = allocations.reduce((sum, item) => sum + item.allocatedCents, 0);
  const signedDollar = (cents: number) => `${cents < 0 ? "-" : ""}${formatDollar(cents / 100)}`;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Account"
        title="Your balance, organized."
        aside="See how available money is distributed across the goals you care about."
        actions={
          <Link href="/settings?tab=account" className={buttonClass({ variant: "secondary" })}>
            <GearSix size={15} weight="bold" /> Manage sectors
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-56" />
          <div className="skeleton h-80" />
        </div>
      ) : !summary ? (
        <div className="card-muted p-10 text-muted">Your account summary is not available yet.</div>
      ) : (
        <>
          <Stagger className="grid gap-3 lg:grid-cols-12">
            <StaggerItem className="lg:col-span-8">
              <section className="card-muted relative h-full overflow-clip p-7 md:p-9">
                <div className="dot-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]" aria-hidden="true" />
                <p className="eyebrow relative">Available balance</p>
                <AnimatedNumber
                  value={summary.currentBalanceCents / 100}
                  format={(v) => `${v < 0 ? "-" : ""}${formatDollar(v)}`}
                  duration={1.4}
                  className="num relative mt-5 block text-[48px] font-[360] leading-none tracking-[-0.045em] sm:text-[64px] md:text-[72px]"
                />
                <p className="relative mt-4 text-[13px] text-muted">
                  Started from <span className="num text-foreground">{signedDollar(summary.initialBalanceCents)}</span>
                  {summary.isLowBalance ? (
                    <span className="tag ml-3 bg-yellow-bg text-yellow-fg">Below {formatDollar(summary.lowBalanceThresholdCents / 100)}</span>
                  ) : null}
                </p>
              </section>
            </StaggerItem>
            <StaggerItem className="grid gap-3 lg:col-span-4">
              <FlowCard label="Money in" cents={summary.totalIncomeCents} tone="income" />
              <FlowCard label="Money out" cents={summary.totalExpenseCents} tone="expense" />
            </StaggerItem>
          </Stagger>

          <div className="grid gap-3 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <Panel title="Allocation" subtitle="How your balance is organized" className="h-full">
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
                      formatValue={(v) => formatDollar(v)}
                      activeId={active}
                      onActiveChange={setActive}
                      ariaLabel="Balance allocation by sector"
                    />
                    <p className="num text-[13px] text-muted">{allocations.length} buckets · {formatDollar(total / 100)} total</p>
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
                          <p className="num text-[14px]">{formatDollar(item.allocatedCents / 100)}</p>
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
                            Goal {formatDollar(item.targetAmountCents / 100)} · {Math.round(item.progressPercent ?? 0)}% reached
                          </p>
                        ) : null}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </section>
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}

function FlowCard({ label, cents, tone }: { label: string; cents: number; tone: "income" | "expense" }) {
  const Icon = tone === "income" ? ArrowDownLeft : ArrowUpRight;
  return (
    <article className="card card-hover flex h-full flex-col justify-between gap-6 p-6">
      <p className="flex items-center justify-between text-[13px] text-muted">
        {label}
        <span className={cn("grid h-7 w-7 place-items-center rounded-full bg-surface-2", tone === "income" ? "text-income" : "text-expense")}>
          <Icon size={13} weight="bold" />
        </span>
      </p>
      <AnimatedNumber
        value={cents / 100}
        format={(v) => formatDollar(v)}
        className="num block text-[28px] leading-none tracking-[-0.03em]"
      />
    </article>
  );
}
