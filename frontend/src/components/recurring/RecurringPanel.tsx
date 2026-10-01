"use client";

import { ArrowsLeftRight, Pause, PencilSimple, Play, Plus, Trash } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Frequency, Occurrence, RecurringRule } from "@/lib/api/recurring";
import {
  useConfirmOccurrence,
  useDeleteRecurring,
  usePauseRecurring,
  useRecurring,
  useResumeRecurring,
  useSkipOccurrence,
} from "@/lib/hooks/useRecurring";
import { cn } from "@/lib/utils/cn";
import { currencySymbol, formatCents, parseAmountInput } from "@/lib/utils/money";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "weekly",
  biweekly: "every 2 weeks",
  monthly: "monthly",
  quarterly: "every 3 months",
  yearly: "yearly",
};

export const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export function RecurringPanel({ onNew, onEdit }: { onNew: () => void; onEdit: (rule: RecurringRule) => void }) {
  const { data, isLoading } = useRecurring();
  const toast = useToast();
  const pause = usePauseRecurring();
  const resume = useResumeRecurring();
  const remove = useDeleteRecurring();
  const [deleting, setDeleting] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  const groups: Array<{ title: string; subtitle: string; rules: RecurringRule[] }> = [
    { title: "Income", subtitle: "Salary and other regular money in", rules: data.rules.filter((r) => r.type === "income") },
    { title: "Bills & subscriptions", subtitle: "Regular spending", rules: data.rules.filter((r) => r.type === "expense") },
    { title: "Saving, investing & debt", subtitle: "Regular transfers between your accounts", rules: data.rules.filter((r) => r.type === "transfer") },
  ];

  const act = (promise: Promise<unknown>, success: string) =>
    promise.then(() => toast.success(success)).catch((error: unknown) => toast.error(errorMessage(error)));

  return (
    <div className="space-y-6">
      {data.due.length ? (
        <section className="card overflow-hidden">
          <Header title="Due" subtitle="Confirm the amount, or skip this one." />
          <ul className="divide-y divide-line">
            {data.due.map((occurrence) => (
              <DueRow key={occurrence.ruleId} occurrence={occurrence} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="card p-5">
          <p className="text-[13px] text-muted">Subscriptions</p>
          <p className="num mt-3 text-[24px] leading-none tracking-[-0.03em]">
            {formatCents(data.subscriptions.monthlyCents)}
            <span className="text-[14px] text-muted">/mo</span>
          </p>
          <p className="mt-1.5 text-[12px] text-muted">
            <span className="num text-foreground">{formatCents(data.subscriptions.yearlyCents)}</span> a year across{" "}
            {data.subscriptions.count} {data.subscriptions.count === 1 ? "subscription" : "subscriptions"}. Worth every one?
          </p>
        </article>
        <article className="card flex flex-col justify-between gap-4 p-5">
          <div>
            <p className="text-[13px] text-muted">Automate the boring parts</p>
            <p className="mt-1 text-[13px]">
              Salary that records itself sets your goals aside on payday — saving without willpower.
            </p>
          </div>
          <Button size="sm" className="w-fit" onClick={onNew}>
            <Plus size={12} weight="bold" /> New recurring
          </Button>
        </article>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="card overflow-hidden">
          <Header title={group.title} subtitle={group.subtitle} />
          {group.rules.length ? (
            <ul className="divide-y divide-line">
              {group.rules.map((rule) => (
                <li key={rule.id} className={cn("group flex items-center gap-4 px-6 py-4 md:px-7", rule.pausedAt && "opacity-60")}>
                  <RuleIcon rule={rule} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[14px]">{rule.name}</p>
                      {rule.autoPost ? <span className="tag bg-surface-3 text-muted">Automatic</span> : null}
                      {rule.isSubscription ? <span className="tag bg-blue-bg text-blue-fg">Subscription</span> : null}
                      {rule.pausedAt ? <span className="tag bg-yellow-bg text-yellow-fg">Paused</span> : null}
                    </div>
                    <p className="truncate text-[12px] text-muted">
                      {FREQUENCY_LABEL[rule.frequency]} ·{" "}
                      {rule.type === "transfer" ? `${rule.accountName} → ${rule.counterAccountName}` : `${rule.categoryName} · ${rule.accountName}`}
                      {" · "}
                      {rule.pausedAt ? "paused" : rule.nextDueDate ? `next ${formatDay(rule.nextDueDate)}` : "ended"}
                    </p>
                  </div>
                  <p className="num shrink-0 text-right text-[14px]">
                    {rule.type === "income" ? "+" : rule.type === "expense" ? "-" : ""}
                    {formatCents(rule.amountCents)}
                  </p>
                  <div className="flex shrink-0 gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <IconButton label={`Edit ${rule.name}`} onClick={() => onEdit(rule)}>
                      <PencilSimple size={14} weight="bold" />
                    </IconButton>
                    {rule.pausedAt ? (
                      <IconButton label={`Resume ${rule.name}`} onClick={() => act(resume.mutateAsync(rule.id), `${rule.name} resumed from today.`)}>
                        <Play size={14} weight="bold" />
                      </IconButton>
                    ) : (
                      <IconButton label={`Pause ${rule.name}`} onClick={() => act(pause.mutateAsync(rule.id), `${rule.name} paused.`)}>
                        <Pause size={14} weight="bold" />
                      </IconButton>
                    )}
                    <IconButton
                      label={deleting === rule.id ? `Click again to delete ${rule.name}` : `Delete ${rule.name}`}
                      danger
                      onClick={() => {
                        if (deleting !== rule.id) return setDeleting(rule.id);
                        setDeleting(null);
                        act(remove.mutateAsync(rule.id), `${rule.name} deleted. Entries it recorded stay in your ledger.`);
                      }}
                    >
                      <Trash size={14} weight="bold" className={deleting === rule.id ? "text-red-fg" : undefined} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-[13px] text-muted md:px-7">Nothing here yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function DueRow({ occurrence }: { occurrence: Occurrence }) {
  const confirm = useConfirmOccurrence();
  const skip = useSkipOccurrence();
  const toast = useToast();
  const [amount, setAmount] = useState(String(occurrence.amountCents / 100));
  const busy = confirm.isPending || skip.isPending;

  function onConfirm() {
    const parsed = parseAmountInput(amount);
    if (!parsed || !Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    confirm.mutate(
      { id: occurrence.ruleId, amount: parsed },
      {
        onSuccess: (result) =>
          toast.success(
            result.goalAllocation.length
              ? `${occurrence.name} recorded. Set aside ${formatCents(result.goalAllocation.reduce((sum, item) => sum + item.amountCents, 0))} for goals.`
              : `${occurrence.name} recorded.`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-4 md:px-7">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px]">{occurrence.name}</p>
        <p className="text-[12px] text-muted">Due {formatDay(occurrence.date)}</p>
      </div>
      <div className="relative w-36">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{currencySymbol()}</span>
        <input
          aria-label={`${occurrence.name} amount`}
          inputMode="decimal"
          className="field num h-9 pl-7 text-[13px]"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <Button size="sm" onClick={onConfirm} disabled={busy}>
        Record
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() =>
          skip.mutate(occurrence.ruleId, {
            onSuccess: () => toast.success(`${occurrence.name} skipped this time.`),
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      >
        Skip
      </Button>
    </li>
  );
}

function RuleIcon({ rule }: { rule: RecurringRule }) {
  if (rule.type === "transfer") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-muted">
        <ArrowsLeftRight size={15} weight="bold" />
      </span>
    );
  }
  const color = rule.categoryColor ?? "#868685";
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <CategoryIcon name={rule.categoryIcon} size={15} />
    </span>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-line px-6 py-5 md:px-7">
      <h2 className="text-[15px]">{title}</h2>
      <p className="text-[13px] text-muted">{subtitle}</p>
    </div>
  );
}

function IconButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors",
        danger ? "hover:bg-red-bg hover:text-red-fg" : "hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
