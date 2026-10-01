"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HealthMetric } from "@/lib/api/insights";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

const signedMonthly = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatCents(Math.abs(cents), 0)}/mo`;

/** The metric's value as the user reads it. */
export function formatMetricValue(metric: HealthMetric): string {
  if (metric.value === null) return "—";
  switch (metric.unit) {
    case "percent":
      return `${metric.value.toFixed(1)}%`;
    case "months":
      return `${metric.value.toFixed(1)} mo`;
    case "cents":
      return metric.value === 0 ? "None" : formatCents(metric.value, 0);
    case "cents_per_month":
      return signedMonthly(metric.value);
    case "share":
      return metric.value >= 100 ? "Covered" : metric.value > 0 ? "Partly covered" : "Not covered";
  }
}

/** The healthy anchor as a target: "≥ 20%", "≤ 30%", "None". */
export function formatMetricTarget(metric: HealthMetric): string {
  const atLeast = metric.healthy >= metric.poor;
  const op = atLeast ? "≥" : "≤";
  switch (metric.unit) {
    case "percent":
      return `${op} ${metric.healthy}%`;
    case "months":
      return `${op} ${metric.healthy} mo`;
    case "cents":
      return "None";
    case "cents_per_month":
      return `${op} ${signedMonthly(metric.healthy)}`;
    case "share":
      return "Covered";
  }
}

// Neutral rather than red for low scores: a starting point, not a failure.
function barClass(score: number) {
  if (score >= 70) return "bg-green-fg";
  if (score >= 40) return "bg-yellow-fg";
  return "bg-faint";
}

/** Every metric behind the score, with its value, target and how to improve. */
export function HealthBreakdown({ metrics }: { metrics: HealthMetric[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <ul className="divide-y divide-line">
      {metrics.map((metric) => (
        <li key={metric.key} className={cn("grid gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]", !metric.available && "opacity-70")}>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] text-foreground">{metric.label}</p>
              <p className="num shrink-0 text-[14px]">{formatMetricValue(metric)}</p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-surface-2">
                {metric.score !== null ? (
                  <motion.div
                    className={cn("h-full rounded-full", barClass(metric.score))}
                    style={{ originX: 0 }}
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: Math.max(metric.score, 2) / 100 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
              </div>
              <span className="num w-16 shrink-0 text-right text-[12px] text-muted">
                {metric.available ? `${metric.score}/100` : "No data"}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-faint">
              Target {formatMetricTarget(metric)} · weight {metric.weight}
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-muted md:pt-0.5">{metric.tip}</p>
        </li>
      ))}
    </ul>
  );
}
