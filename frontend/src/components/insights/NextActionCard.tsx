"use client";

import { ArrowRight, Compass } from "@phosphor-icons/react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import type { NextAction } from "@/lib/api/insights";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

/** "৳12,000 to go · ৳3,000/month gets you there in 4 months" */
function amountLine(action: NextAction) {
  const parts: string[] = [];
  if (action.amountCents !== null) {
    parts.push(
      action.key === "cover_overspend"
        ? `${formatCents(action.amountCents, 0)} short`
        : action.key === "high_interest_debt"
          ? `${formatCents(action.amountCents, 0)} owed`
          : `${formatCents(action.amountCents, 0)} to go`,
    );
  }
  if (action.monthlyCents !== null) {
    parts.push(
      action.months !== null
        ? `${formatCents(action.monthlyCents, 0)}/month gets you there in ${action.months} ${action.months === 1 ? "month" : "months"}`
        : `${formatCents(action.monthlyCents, 0)} more a month`,
    );
  }
  return parts.join(" · ");
}

/** The single next step from the money waterfall. */
export function NextActionCard({
  action,
  isLoading,
  className,
}: {
  action: NextAction | undefined;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading || !action) {
    return (
      <div className={cn("card space-y-4 p-6 md:p-7", className)}>
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-7 w-64 max-w-full" />
        <div className="skeleton h-4 w-full" />
      </div>
    );
  }

  const line = amountLine(action);

  return (
    <section className={cn("card card-hover flex flex-col p-6 md:p-7", className)} aria-labelledby="next-action-title">
      <p className="eyebrow flex items-center gap-2">
        <Compass size={13} weight="bold" aria-hidden="true" />
        Next best step
        {action.step ? <span className="num text-faint">· {action.step}</span> : null}
      </p>
      <h2 id="next-action-title" className="mt-3 text-[20px] leading-[1.25] tracking-[-0.015em] text-foreground">
        {action.title}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{action.detail}</p>
      {line ? <p className="num mt-3 text-[13px] text-foreground">{line}</p> : null}
      <div className="mt-auto pt-5">
        <Link href={action.href} className={buttonClass({ size: "sm", variant: action.key === "on_track" ? "secondary" : "primary" })}>
          {action.cta} <ArrowRight size={13} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
