"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, GearSix, Plus, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { GoalsBreakdown } from "@/components/dashboard/GoalsBreakdown";
import { AnimatedNumber } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/Button";
import type { AccountSummary } from "@/lib/api/account";
import { cn } from "@/lib/utils/cn";
import { formatMoneyAbs } from "@/lib/utils/money";

type AccountBalanceWidgetProps = {
  className?: string;
  // Supplied by the dashboard overview request rather than fetched here, so
  // the dashboard needs one round trip instead of two.
  summary: AccountSummary | undefined;
  isLoading: boolean;
};

export function AccountBalanceWidget({ className, summary, isLoading }: AccountBalanceWidgetProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div className={cn("card-muted space-y-5 p-7 md:p-8", className)}>
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-14 w-72 max-w-full" />
        <div className="skeleton h-4 w-56" />
      </div>
    );
  }

  const isEmpty =
    !summary || (summary.initialBalanceCents === 0 && summary.totalIncomeCents === 0 && summary.totalExpenseCents === 0);

  if (isEmpty) {
    return (
      <div className={cn("card-muted relative flex flex-col justify-between gap-8 overflow-clip p-7 md:p-8", className)}>
        <div className="dot-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,black,transparent_70%)]" aria-hidden="true" />
        <div className="relative">
          <p className="eyebrow">Account balance</p>
          <p className="mt-4 max-w-sm text-[24px] leading-[1.2] tracking-[-0.02em] text-foreground">
            Nothing to show yet.
            <span className="text-ghost"> Add your accounts and what they hold to see a running total.</span>
          </p>
        </div>
        <Link href="/accounts" className={buttonClass({ className: "relative w-fit" })}>
          <Plus size={14} weight="bold" /> Add accounts
        </Link>
      </div>
    );
  }

  // Money set aside for goals is not available to spend.
  const negative = summary.availableCents < 0;
  const warning = summary.isLowBalance && !negative;

  return (
    <motion.section
      className={cn("card-muted relative flex flex-col overflow-clip p-7 md:p-8", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.9),transparent)] opacity-70 dark:bg-[radial-gradient(closest-side,rgb(255_255_255/0.04),transparent)]"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="eyebrow">Available to spend</p>
          {negative || warning ? (
            <span className={cn("tag", negative ? "bg-red-bg text-red-fg" : "bg-yellow-bg text-yellow-fg")}>
              <Warning size={11} weight="fill" />
              {negative ? "Negative" : "Low balance"}
            </span>
          ) : null}
        </div>
        <Link
          href="/settings?tab=account"
          aria-label="Account settings"
          title="Account settings"
          className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <GearSix size={16} weight="bold" />
        </Link>
      </div>

      <AnimatedNumber
        value={summary.availableCents / 100}
        format={(value) => `${value < 0 ? "-" : ""}${formatMoneyAbs(value)}`}
        duration={0.7}
        className="num relative mt-5 block text-[44px] font-[360] leading-none tracking-[-0.045em] text-foreground sm:text-[56px] md:text-[64px]"
      />

      <p className="relative mt-3 text-[13px] text-muted">
        {negative
          ? "You have spent into money set aside for goals, or below zero."
          : warning
            ? `Below your ${formatMoneyAbs(summary.lowBalanceThresholdCents / 100)} low-balance alert.`
            : null}
        {summary.earmarkedCents > 0 ? (
          <span className={negative || warning ? "block" : undefined}>
            Plus <span className="num text-foreground">{formatMoneyAbs(summary.earmarkedCents / 100)}</span> set aside for goals.
          </span>
        ) : null}
      </p>

      <div className="relative mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 pt-8 text-[13px]">
        <span className="flex items-center gap-2 text-muted">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-surface text-income">
            <ArrowDownLeft size={11} weight="bold" />
          </span>
          In <span className="num text-foreground">{formatMoneyAbs(summary.totalIncomeCents / 100)}</span>
        </span>
        <span className="flex items-center gap-2 text-muted">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-surface text-expense">
            <ArrowUpRight size={11} weight="bold" />
          </span>
          Out <span className="num text-foreground">{formatMoneyAbs(summary.totalExpenseCents / 100)}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="ml-auto flex items-center gap-2 rounded-[6px] py-1 text-foreground transition-opacity hover:opacity-70"
        >
          Goals
          <span className="relative grid h-4 w-4 place-items-center" aria-hidden="true">
            <span className="absolute h-px w-2.5 bg-current" />
            <motion.span
              className="absolute h-2.5 w-px bg-current"
              animate={{ rotate: open ? 90 : 0, opacity: open ? 0 : 1 }}
              transition={{ duration: 0.25 }}
            />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-clip"
          >
            <div className="mt-6 border-t border-line-strong/60 pt-6">
              <GoalsBreakdown goals={summary.goals} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
