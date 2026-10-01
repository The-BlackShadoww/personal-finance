"use client";

import { ArrowLeft, ArrowRight, Check, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ErrorNote } from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Button, buttonClass } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { MonthlyReview, ReviewItem, WorthIt } from "@/lib/api/reviews";
import { useCompleteReview, useMonthlyReview, useReviewStatus } from "@/lib/hooks/useHabits";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

const STEPS = ["The numbers", "Wins", "Leaks", "Worth it?", "One thing"] as const;

const monthName = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

function lastMonth() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="skeleton h-[480px]" />}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const { data: status } = useReviewStatus();
  const requestedYear = Number(searchParams.get("year"));
  const requestedMonth = Number(searchParams.get("month"));
  const period =
    requestedYear && requestedMonth >= 1 && requestedMonth <= 12
      ? { year: requestedYear, month: requestedMonth }
      : (status?.due ?? lastMonth());
  const { data, isLoading, isError, error } = useMonthlyReview(period.year, period.month);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Monthly review"
        title={`${monthName(period.year, period.month)}.`}
        aside="Five minutes: what happened, what to keep, what to change."
      />
      {isError ? <ErrorNote>{error instanceof Error ? error.message : "Could not load the review."}</ErrorNote> : null}
      {isLoading || !data ? <div className="skeleton h-[420px]" /> : <ReviewWizard key={`${data.year}-${data.month}`} review={data} />}
      {status?.history.length ? <History history={status.history} /> : null}
    </div>
  );
}

function ReviewWizard({ review }: { review: MonthlyReview }) {
  const reduceMotion = useReducedMotion();
  const complete = useCompleteReview();
  const [step, setStep] = useState(0);
  const [ratings, setRatings] = useState<Record<string, WorthIt>>(review.completed?.worthIt ?? {});
  const [previousDone, setPreviousDone] = useState<boolean | null>(review.previousAction?.done ?? null);
  const [action, setAction] = useState(review.completed?.action ?? "");
  const [result, setResult] = useState<Array<{ categoryId: string; name: string }> | null>(null);

  useEffect(() => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }), [step, reduceMotion]);

  function finish() {
    complete.mutate(
      {
        year: review.year,
        month: review.month,
        payload: {
          worthIt: ratings,
          action: action.trim() || undefined,
          previousActionDone: previousDone ?? undefined,
        },
      },
      { onSuccess: (saved) => setResult(saved.lowerBudgets) },
    );
  }

  if (result) {
    return (
      <section className="card-muted max-w-2xl space-y-5 p-7 md:p-9">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-green-bg text-green-fg">
          <Check size={18} weight="bold" />
        </span>
        <h2 className="text-[22px] tracking-[-0.015em]">Review done.</h2>
        {action.trim() ? (
          <p className="text-[14px] text-muted">
            Next month: <span className="text-foreground">{action.trim()}</span>. We&apos;ll ask how it went.
          </p>
        ) : null}
        {result.length ? (
          <p className="rounded-[8px] bg-surface px-4 py-3 text-[13px] text-muted">
            You&apos;ve said {result.length === 1 ? `${result[0].name} wasn't` : `${result.map((r) => r.name).join(", ")} weren't`}{" "}
            worth it more than once. Lower {result.length === 1 ? "its budget" : "their budgets"} next month and put the
            difference toward what you do value.{" "}
            <Link href="/budgets" className="text-foreground underline underline-offset-4">
              Open the plan
            </Link>
          </p>
        ) : null}
        <Link href="/dashboard" className={buttonClass({ variant: "secondary", size: "sm" })}>
          Back to overview
        </Link>
      </section>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Review steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] transition-colors",
                index === step ? "bg-strong text-strong-foreground" : index < step ? "bg-surface-3 text-foreground" : "bg-surface-2 text-muted",
              )}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="card p-6 md:p-8"
        >
          {step === 0 ? <NumbersStep review={review} previousDone={previousDone} onPreviousDone={setPreviousDone} /> : null}
          {step === 1 ? (
            <ItemsStep title="Three wins" empty="A quieter month — steady counts too." items={review.wins} tone="win" />
          ) : null}
          {step === 2 ? (
            <ItemsStep
              title="Three leaks"
              empty="Nothing leaked worth flagging. Nice."
              items={review.leaks}
              tone="leak"
            />
          ) : null}
          {step === 3 ? <WorthItStep review={review} ratings={ratings} onChange={setRatings} /> : null}
          {step === 4 ? <ActionStep suggestions={review.suggestedActions} action={action} onChange={setAction} /> : null}
        </motion.section>
      </AnimatePresence>

      {complete.error instanceof Error ? <ErrorNote>{complete.error.message}</ErrorNote> : null}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
          <ArrowLeft size={14} weight="bold" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next <ArrowRight size={14} weight="bold" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={complete.isPending}>
            {complete.isPending ? <Spinner /> : null}
            {review.completed ? "Update review" : "Finish review"}
          </Button>
        )}
      </div>
    </div>
  );
}

function NumbersStep({
  review,
  previousDone,
  onPreviousDone,
}: {
  review: MonthlyReview;
  previousDone: boolean | null;
  onPreviousDone: (done: boolean) => void;
}) {
  const { numbers } = review;
  const scoreChange =
    numbers.healthScore !== null && numbers.previousHealthScore !== null ? numbers.healthScore - numbers.previousHealthScore : null;
  const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatCents(Math.abs(cents), 0)}`;

  return (
    <div className="space-y-6">
      <StepTitle>How the month went</StepTitle>
      {review.previousAction ? (
        <div className="rounded-[10px] bg-surface-2 px-5 py-4">
          <p className="text-[13px] text-muted">
            Last month you committed to: <span className="text-foreground">{review.previousAction.action}</span>
          </p>
          <div className="mt-3 flex gap-2">
            {[
              { value: true, label: "Done" },
              { value: false, label: "Not this time" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onPreviousDone(option.value)}
                aria-pressed={previousDone === option.value}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px]",
                  previousDone === option.value ? "border-foreground bg-surface text-foreground" : "border-line text-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Figure label="Income" value={formatCents(numbers.incomeCents, 0)} />
        <Figure label="Spending" value={formatCents(numbers.expenseCents, 0)} />
        <Figure
          label="Savings rate"
          value={numbers.savingsRate === null ? "—" : `${numbers.savingsRate.toFixed(1)}%`}
          note={`target ${numbers.savingsTarget}%`}
        />
        <Figure
          label="Net worth change"
          value={numbers.netWorthChangeCents === null ? "—" : signed(numbers.netWorthChangeCents)}
        />
        <Figure
          label="Health score"
          value={numbers.healthScore === null ? "—" : String(numbers.healthScore)}
          note={
            scoreChange === null
              ? "first review"
              : scoreChange === 0
                ? "same as last review"
                : `${scoreChange > 0 ? "+" : ""}${scoreChange} since last review`
          }
        />
      </dl>
    </div>
  );
}

function ItemsStep({ title, empty, items, tone }: { title: string; empty: string; items: ReviewItem[]; tone: "win" | "leak" }) {
  return (
    <div className="space-y-5">
      <StepTitle>{title}</StepTitle>
      {items.length ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.title}`} className="flex gap-3.5">
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  tone === "win" ? "bg-green-fg" : "bg-yellow-fg",
                )}
                aria-hidden="true"
              />
              <div>
                <p className="text-[15px] text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[13px] text-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">{empty}</p>
      )}
    </div>
  );
}

const RATING_OPTIONS: Array<{ value: WorthIt; label: string; icon: ReactNode }> = [
  { value: "yes", label: "Worth it", icon: <ThumbsUp size={14} weight="bold" /> },
  { value: "meh", label: "Meh", icon: <span aria-hidden="true">~</span> },
  { value: "no", label: "Not worth it", icon: <ThumbsDown size={14} weight="bold" /> },
];

function WorthItStep({
  review,
  ratings,
  onChange,
}: {
  review: MonthlyReview;
  ratings: Record<string, WorthIt>;
  onChange: (ratings: Record<string, WorthIt>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepTitle>Was it worth it?</StepTitle>
      <p className="-mt-2 text-[13px] text-muted">
        Your biggest non-essential spending this month. Spend freely on what you value, and cut what you don&apos;t.
      </p>
      {review.worthIt.length ? (
        <ul className="divide-y divide-line">
          {review.worthIt.map((candidate) => {
            const rating = ratings[candidate.categoryId];
            return (
              <li key={candidate.categoryId} className="py-3.5 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[14px]">
                    {candidate.name} <span className="num text-muted">· {formatCents(candidate.spentCents, 0)}</span>
                  </p>
                  <div className="flex gap-1.5" role="group" aria-label={`Was ${candidate.name} worth it?`}>
                    {RATING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        title={option.label}
                        aria-label={option.label}
                        aria-pressed={rating === option.value}
                        onClick={() => onChange({ ...ratings, [candidate.categoryId]: option.value })}
                        className={cn(
                          "grid h-8 w-10 place-items-center rounded-[6px] border text-[13px] transition-colors",
                          rating === option.value
                            ? "border-foreground bg-surface-2 text-foreground"
                            : "border-line text-muted hover:text-foreground",
                        )}
                      >
                        {option.icon}
                      </button>
                    ))}
                  </div>
                </div>
                {rating === "no" && candidate.previousNo > 0 ? (
                  <p className="mt-2 text-[12px] text-muted">
                    Not the first time. Consider a lower budget for {candidate.name} next month.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">No non-essential spending to rate this month.</p>
      )}
    </div>
  );
}

function ActionStep({
  suggestions,
  action,
  onChange,
}: {
  suggestions: string[];
  action: string;
  onChange: (action: string) => void;
}) {
  return (
    <div className="space-y-5">
      <StepTitle>One thing for next month</StepTitle>
      <p className="-mt-2 text-[13px] text-muted">Just one. It&apos;s easier to keep, and next month&apos;s review will ask.</p>
      {suggestions.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange(suggestion)}
              aria-pressed={action === suggestion}
              className={cn(
                "rounded-full border px-3 py-1.5 text-left text-[13px]",
                action === suggestion ? "border-foreground bg-surface-2 text-foreground" : "border-line text-muted hover:text-foreground",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="review-action">
          Your commitment <span className="text-faint">optional</span>
        </label>
        <input
          id="review-action"
          className="field"
          maxLength={300}
          placeholder="e.g. Cook at home on weekdays"
          value={action}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function History({ history }: { history: Array<{ year: number; month: number; action: string | null; actionDone: boolean | null }> }) {
  return (
    <section className="max-w-3xl">
      <h2 className="px-1 text-[15px]">Past reviews</h2>
      <ul className="card mt-3 divide-y divide-line">
        {history.map((item) => (
          <li key={`${item.year}-${item.month}`} className="flex items-center justify-between gap-4 px-6 py-3 text-[13px]">
            <Link href={`/review?year=${item.year}&month=${item.month}`} className="text-foreground underline-offset-4 hover:underline">
              {monthName(item.year, item.month)}
            </Link>
            <span className="min-w-0 truncate text-muted">
              {item.action ? (
                <>
                  {item.action}
                  {item.actionDone === true ? " · done" : item.actionDone === false ? " · not done" : ""}
                </>
              ) : (
                "No commitment"
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[20px] tracking-[-0.015em]">{children}</h2>;
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="num mt-1 text-[24px] leading-none tracking-[-0.03em]">{value}</dd>
      {note ? <dd className="mt-1.5 text-[12px] text-faint">{note}</dd> : null}
    </div>
  );
}
