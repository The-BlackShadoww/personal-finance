"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AreaChart } from "@/components/charts/AreaChart";
import { Legend } from "@/components/charts/core";
import { DonutChart } from "@/components/charts/DonutChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { AnimatedNumber, EASE_OUT_EXPO } from "@/components/motion/Reveal";

const FLOW = [
  { label: "Apr", title: "April", values: { income: 7800, expense: 5200 } },
  { label: "May", title: "May", values: { income: 8100, expense: 4900 } },
  { label: "Jun", title: "June", values: { income: 7900, expense: 5600 } },
  { label: "Jul", title: "July", values: { income: 8420, expense: 4700 } },
  { label: "Aug", title: "August", values: { income: 8300, expense: 5100 } },
  { label: "Sep", title: "September", values: { income: 8900, expense: 4180 } },
];

const SERIES = [
  { key: "income", label: "Income", color: "var(--ds-series-income)" },
  { key: "expense", label: "Expenses", color: "var(--ds-series-expense)" },
];

const SLICES = [
  { id: "housing", label: "Housing", value: 1650, color: "#2a78d6" },
  { id: "groceries", label: "Groceries", value: 640, color: "#1baf7a" },
  { id: "transport", label: "Transport", value: 310, color: "#eb6834" },
  { id: "dining", label: "Dining out", value: 280, color: "#eda100" },
  { id: "other", label: "Other", value: 420, color: "#a8a7a5" },
];

const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export function HeroPreview() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.5 }}
      className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_30px_80px_-20px_rgb(22_21_20/0.12)] dark:shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]"
    >
      {/* Faux-OS window chrome */}
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="mx-auto hidden rounded-[4px] bg-surface-2 px-16 py-0.5 font-mono text-[11px] text-muted sm:block">
          personal-finance / overview
        </span>
        <span className="w-10" />
      </div>

      <div className="grid gap-3 bg-background p-3 md:grid-cols-12 md:p-4">
        <div className="card-muted flex flex-col justify-between gap-6 p-6 md:col-span-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Account balance</p>
            <span className="tag bg-green-bg text-green-fg">On track</span>
          </div>
          <div>
            <AnimatedNumber
              value={24860.42}
              duration={2}
              format={(v) =>
                `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
              className="num block text-[40px] font-[360] leading-none tracking-[-0.045em]"
            />
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-muted">
                Kept <span className="num text-foreground">$4,720</span> in September
              </p>
              <Sparkline values={[18, 22, 19, 27, 24, 31]} color="var(--ds-series-net)" width={90} height={30} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-line-strong/60 pt-4 text-[12px]">
            {[
              ["Income", "$8,900"],
              ["Spent", "$4,180"],
              ["Rate", "53.0%"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-muted">{label}</p>
                <p className="num mt-0.5 text-[14px]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 md:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px]">Cash flow</p>
            <Legend series={SERIES} />
          </div>
          <AreaChart data={FLOW} series={SERIES} height={210} formatValue={money} ariaLabel="Example cash flow chart" />
        </div>

        <div className="card hidden items-center gap-6 p-5 md:col-span-12 md:flex">
          <DonutChart slices={SLICES} size={150} thickness={16} centerLabel="Spent" formatValue={money} ariaLabel="Example spending by category" />
          <ul className="grid flex-1 grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-3">
            {SLICES.map((slice) => (
              <li key={slice.id} className="text-[13px]">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                  {slice.label}
                </span>
                <span className="num mt-0.5 block pl-4 text-foreground">{money(slice.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
