"use client";

import { ArrowDownRight, ArrowUpRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { AnimatedNumber } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card card-hover flex flex-col p-6 md:p-7", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="text-[15px] text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className={cn("mt-6 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Delta = {
  /** Signed change. */
  value: number;
  /** Whether an increase is a good thing for this metric. */
  upIsGood: boolean;
  /** Short name of the comparison period, e.g. "last month". */
  against: string;
  format: (value: number) => string;
};

export function StatTile({
  label,
  value,
  format,
  delta,
  trend,
  trendColor,
  isLoading,
  dotColor,
  className,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  delta?: Delta | null;
  trend?: number[];
  trendColor?: string;
  isLoading?: boolean;
  dotColor?: string;
  className?: string;
}) {
  return (
    <article className={cn("card card-hover flex min-h-[152px] flex-col justify-between p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          {dotColor ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} /> : null}
          {label}
        </p>
        {trend && trend.length > 1 && !isLoading ? (
          <Sparkline values={trend} color={trendColor ?? "var(--ds-muted)"} width={72} height={26} />
        ) : null}
      </div>
      {isLoading ? (
        <div className="space-y-2.5">
          <div className="skeleton h-8 w-36" />
          <div className="skeleton h-3.5 w-24" />
        </div>
      ) : (
        <div>
          <AnimatedNumber
            value={value}
            format={format}
            className="num block text-[28px] leading-none tracking-[-0.03em] text-foreground md:text-[30px]"
          />
          <DeltaLine delta={delta} />
        </div>
      )}
    </article>
  );
}

export function DeltaLine({ delta }: { delta?: Delta | null }) {
  if (!delta) return <p className="mt-2.5 h-5 text-[12px] text-faint">No earlier period to compare</p>;
  if (delta.value === 0) {
    return <p className="mt-2.5 text-[12px] text-muted">No change vs {delta.against}</p>;
  }
  const up = delta.value > 0;
  const good = up === delta.upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 num",
          good ? "bg-green-bg text-green-fg" : "bg-red-bg text-red-fg",
        )}
      >
        <Icon size={11} weight="bold" aria-hidden="true" />
        {delta.format(Math.abs(delta.value))}
      </span>
      <span>vs {delta.against}</span>
    </p>
  );
}

export function PeriodStepper({
  label,
  onPrevious,
  onNext,
  canGoNext = true,
  previousLabel,
  nextLabel,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
  previousLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="inline-flex h-9 w-fit items-center self-start rounded-[8px] border border-line bg-surface sm:self-auto">
      <button
        type="button"
        onClick={onPrevious}
        aria-label={previousLabel}
        title={previousLabel}
        className="grid h-full w-9 place-items-center rounded-l-[8px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <CaretLeft size={14} weight="bold" />
      </button>
      <span className="relative min-w-[136px] overflow-clip border-x border-line px-3 text-center text-[14px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={label}
            className="block num"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label={nextLabel}
        title={canGoNext ? nextLabel : "Cannot move into the future"}
        className="grid h-full w-9 place-items-center rounded-r-[8px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <CaretRight size={14} weight="bold" />
      </button>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[8px] bg-red-bg px-4 py-3 text-[14px] text-red-fg">
      {children}
    </div>
  );
}

export const pct = (value: number) => `${value.toFixed(1)}%`;
