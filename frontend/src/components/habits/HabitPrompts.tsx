"use client";

import { CalendarCheck, Hourglass, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { useReviewStatus, useWishlist } from "@/lib/hooks/useHabits";

const dismissKey = (year: number, month: number) => `pf-review-dismissed-${year}-${month}`;

function readDismissed(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Nudges on the dashboard: last month's review, and wants ready to decide. */
export function HabitPrompts() {
  const { data: status } = useReviewStatus();
  const { data: wishlist } = useWishlist();
  const due = status?.due ?? null;
  const [dismissed, setDismissed] = useState(true);

  // Read after mount: storage is per viewer and unavailable during SSR.
  useEffect(() => {
    if (due) setDismissed(readDismissed(dismissKey(due.year, due.month)));
  }, [due]);

  function dismiss() {
    if (!due) return;
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey(due.year, due.month), "1");
    } catch {
      // Storage unavailable: the prompt comes back next visit.
    }
  }

  const ready = wishlist?.summary.readyCount ?? 0;
  const showReview = due !== null && !dismissed;
  if (!showReview && !ready) return null;

  const monthName = due ? new Date(due.year, due.month - 1, 1).toLocaleString("en-US", { month: "long" }) : "";

  return (
    <div className="space-y-3">
      {showReview && due ? (
        <section className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-5 md:p-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-muted">
            <CalendarCheck size={16} weight="bold" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px]">{monthName} is over. Take five minutes to review it.</p>
            <p className="text-[13px] text-muted">Your wins, what leaked, what was worth it, and one thing for next month.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href={`/review?year=${due.year}&month=${due.month}`} className={buttonClass({ size: "sm" })}>
              Start review
            </Link>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Not now"
              title="Not now (open it later from Insights)"
              className="grid h-8 w-8 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </section>
      ) : null}
      {ready ? (
        <Link
          href="/goals"
          className="flex items-center gap-3 rounded-[10px] bg-surface-2 px-5 py-3.5 text-[13px] text-muted transition-colors hover:text-foreground"
        >
          <Hourglass size={14} weight="bold" aria-hidden="true" />
          {ready} {ready === 1 ? "item on your cooling-off list is" : "items on your cooling-off list are"} ready to decide.
          Still want {ready === 1 ? "it" : "them"}?
        </Link>
      ) : null}
    </div>
  );
}

/** A link into the monthly review, for the Insights page. */
export function ReviewLink() {
  const { data: status } = useReviewStatus();
  if (!status) return null;
  const latest = status.history[0];
  const target = status.due ?? (latest ? { year: latest.year, month: latest.month } : null);
  if (!target) return null;
  const name = new Date(target.year, target.month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-surface-2 px-5 py-3.5 text-[13px]">
      <span className="text-muted">
        {status.due ? (
          <>
            The <span className="text-foreground">{name}</span> review is waiting.
          </>
        ) : (
          <>
            Last review: <span className="text-foreground">{name}</span>
            {latest?.action ? <> · next step &ldquo;{latest.action}&rdquo;</> : null}
          </>
        )}
      </span>
      <Link href={`/review?year=${target.year}&month=${target.month}`} className="text-foreground underline underline-offset-4">
        {status.due ? "Start review" : "Open"}
      </Link>
    </div>
  );
}
