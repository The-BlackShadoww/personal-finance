"use client";

import {
  Archive,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  PencilSimple,
  Plus,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { GoalForm } from "@/components/goals/GoalForm";
import { GoalMoneyForm, type GoalMoneyAction } from "@/components/goals/GoalMoneyForm";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { Goal, GoalPayload, GoalStatus, GoalUpdatePayload } from "@/lib/api/goals";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCategories } from "@/lib/hooks/useCategories";
import {
  useArchiveGoal,
  useContributeToGoal,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useReorderGoals,
  useRestoreGoal,
  useUpdateGoal,
  useWithdrawFromGoal,
} from "@/lib/hooks/useGoals";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

const FUNDING_NOTICE_KEY = "pf-goals-funding-notice-dismissed";

const STATUS: Record<GoalStatus, { label: string; className: string } | null> = {
  done: { label: "Done", className: "bg-green-bg text-green-fg" },
  ahead: { label: "Ahead", className: "bg-green-bg text-green-fg" },
  on_track: { label: "On track", className: "bg-blue-bg text-blue-fg" },
  behind: { label: "Behind", className: "bg-yellow-bg text-yellow-fg" },
  open: null,
};

const KIND_LABEL: Record<Goal["kind"], string> = {
  emergency: "Emergency fund",
  sinking: "Sinking fund",
  long_term: "Long-term goal",
  custom: "Goal",
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function fundingLabel(goal: Goal) {
  if (goal.fundingRule === "percent_of_income" && goal.fundingPercentBps) {
    return `${goal.fundingPercentBps / 100}% of each income`;
  }
  if (goal.fundingRule === "fixed_monthly" && goal.fundingAmountCents) {
    return `${formatCents(goal.fundingAmountCents, 0)} a month`;
  }
  return "Added by hand";
}

type Editing = Goal | "new" | null;
type MoneyAction = { goal: Goal; action: GoalMoneyAction } | null;

export default function GoalsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useGoals(showArchived);
  const { data: accountsData } = useAccounts(true);
  const { data: categories = [] } = useCategories();
  const toast = useToast();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const reorderGoals = useReorderGoals();
  const contribute = useContributeToGoal();
  const withdraw = useWithdrawFromGoal();
  const archiveGoal = useArchiveGoal();
  const restoreGoal = useRestoreGoal();
  const deleteGoal = useDeleteGoal();
  const [editing, setEditing] = useState<Editing>(null);
  const [money, setMoney] = useState<MoneyAction>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [showFundingNotice, setShowFundingNotice] = useState(false);

  const goals = data?.goals ?? [];
  const emergency = goals.find((goal) => goal.kind === "emergency");
  const others = goals.filter((goal) => goal.kind !== "emergency");
  const activeOrder = goals.filter((goal) => goal.archivedAt === null);
  const accounts = accountsData?.accounts ?? [];
  const defaultAccountId =
    accounts.find((account) => account.kind === "savings" && account.archivedAt === null)?.id ??
    accounts.find((account) => account.isDefault)?.id ??
    "";

  // Nudge toward automation while every goal waits for manual top-ups.
  useEffect(() => {
    if (!data) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(FUNDING_NOTICE_KEY) === "1";
    } catch {
      // Storage unavailable: show the notice.
    }
    setShowFundingNotice(!dismissed && data.goals.every((goal) => goal.fundingRule === "manual"));
  }, [data]);

  function dismissFundingNotice() {
    setShowFundingNotice(false);
    try {
      window.localStorage.setItem(FUNDING_NOTICE_KEY, "1");
    } catch {
      // Storage unavailable: the notice returns next visit.
    }
  }

  function closeForm() {
    setEditing(null);
    createGoal.reset();
    updateGoal.reset();
  }

  function submitGoal(payload: GoalPayload | GoalUpdatePayload) {
    if (editing === "new") {
      createGoal.mutate(payload as GoalPayload, {
        onSuccess: (goal) => {
          toast.success(`${goal.name} created.`);
          closeForm();
        },
      });
    } else if (editing) {
      updateGoal.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            toast.success("Goal saved.");
            closeForm();
          },
        },
      );
    }
  }

  function closeMoney() {
    setMoney(null);
    contribute.reset();
    withdraw.reset();
  }

  function move(goal: Goal, direction: -1 | 1) {
    const order = activeOrder.map((item) => item.id);
    const index = order.indexOf(goal.id);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= order.length) return;
    [order[index], order[swap]] = [order[swap], order[index]];
    reorderGoals.mutate(order, { onError: (error) => toast.error(errorMessage(error)) });
  }

  const actions = {
    onAdd: (goal: Goal) => setMoney({ goal, action: "add" }),
    onWithdraw: (goal: Goal) => setMoney({ goal, action: "withdraw" }),
    onEdit: (goal: Goal) => setEditing(goal),
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Goals"
        title="Give your money a job."
        aside="Set money aside before you can spend it. Goals live inside your accounts, so every amount is real."
        actions={
          <Button onClick={() => setEditing("new")} disabled={!accounts.length}>
            <Plus size={14} weight="bold" /> New goal
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="skeleton h-64" />
          <div className="skeleton h-48" />
        </div>
      ) : (
        <>
          <Stagger className="grid gap-3 sm:grid-cols-3">
            <StaggerItem>
              <Stat label="Available to spend" value={formatCents(data.summary.availableCents)} hint="Liquid money not set aside" />
            </StaggerItem>
            <StaggerItem>
              <Stat label="Set aside for goals" value={formatCents(data.summary.earmarkedCents)} hint={`${activeOrder.length} active goals`} />
            </StaggerItem>
            <StaggerItem>
              <Stat
                label="Essential spending"
                value={
                  data.summary.averageEssentialMonthlyCents !== null
                    ? `${formatCents(data.summary.averageEssentialMonthlyCents, 0)}/mo`
                    : "—"
                }
                hint="Average of needs, last 6 months"
              />
            </StaggerItem>
          </Stagger>

          {data.summary.shortfalls.map((shortfall) => (
            <p key={shortfall.accountId} role="alert" className="flex items-start gap-2.5 rounded-[8px] bg-yellow-bg px-4 py-3 text-[13px] text-yellow-fg">
              <Warning size={15} weight="fill" className="mt-px shrink-0" />
              Goals in {shortfall.accountName} claim {formatCents(shortfall.shortfallCents)} more than it holds. Take money out of
              a goal there, or move money in.
            </p>
          ))}

          {showFundingNotice ? (
            <div className="flex items-start justify-between gap-4 rounded-[10px] border border-line bg-surface px-5 py-4">
              <div>
                <p className="text-[14px]">Choose how each goal is funded.</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  Funding a goal with a share of every income is the easiest way to pay
                  yourself first — it happens the moment income arrives.
                </p>
              </div>
              <button type="button" aria-label="Dismiss" onClick={dismissFundingNotice} className="text-muted hover:text-foreground">
                <X size={14} weight="bold" />
              </button>
            </div>
          ) : null}

          {emergency ? (
            <Reveal>
              <EmergencyCard goal={emergency} {...actions} />
            </Reveal>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-[15px]">Your goals</h2>
                <p className="text-[13px] text-muted">Income is shared out from the top down. Use the arrows to reorder.</p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="h-4 w-4 accent-[var(--ds-foreground)]"
                />
                Show archived
              </label>
            </div>
            {others.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {others.map((goal, index) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    index={index}
                    canMoveUp={activeOrder.indexOf(goal) > 0}
                    canMoveDown={activeOrder.indexOf(goal) >= 0 && activeOrder.indexOf(goal) < activeOrder.length - 1}
                    onMove={move}
                    onArchive={(item) =>
                      archiveGoal.mutate(item.id, {
                        onSuccess: () => toast.success(`${item.name} archived.`),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    onRestore={(item) =>
                      restoreGoal.mutate(item.id, {
                        onSuccess: () => toast.success(`${item.name} restored.`),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    onDelete={setDeleting}
                    {...actions}
                  />
                ))}
              </div>
            ) : (
              <div className="card px-6 py-10 text-center">
                <p className="text-[15px]">No goals yet.</p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
                  Start with a sinking fund for a cost you know is coming — insurance, a festival, a new laptop — so it never
                  becomes an emergency.
                </p>
                <Button className="mt-5" onClick={() => setEditing("new")}>
                  <Plus size={14} weight="bold" /> New goal
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "New goal" : editing?.kind === "emergency" ? "Emergency fund" : "Edit goal"}
        onClose={closeForm}
      >
        {editing !== null ? (
          <GoalForm
            key={editing === "new" ? "new" : editing.id}
            goal={editing === "new" ? undefined : editing}
            accounts={accounts}
            categories={categories}
            defaultAccountId={defaultAccountId}
            submitting={createGoal.isPending || updateGoal.isPending}
            error={((editing === "new" ? createGoal.error : updateGoal.error) as Error | null)?.message ?? null}
            onSubmit={submitGoal}
            onCancel={closeForm}
          />
        ) : null}
      </Modal>

      <Modal
        open={money !== null}
        title={money ? `${money.action === "add" ? "Add money to" : "Take money from"} ${money.goal.name}` : ""}
        size="sm"
        onClose={closeMoney}
      >
        {money ? (
          <GoalMoneyForm
            key={`${money.goal.id}-${money.action}`}
            goal={money.goal}
            action={money.action}
            accounts={accounts}
            submitting={contribute.isPending || withdraw.isPending}
            error={((money.action === "add" ? contribute.error : withdraw.error) as Error | null)?.message ?? null}
            onAdd={(payload) =>
              contribute.mutate(
                { id: money.goal.id, ...payload },
                {
                  onSuccess: () => {
                    toast.success(`Added to ${money.goal.name}.`);
                    closeMoney();
                  },
                },
              )
            }
            onWithdraw={(payload) =>
              withdraw.mutate(
                { id: money.goal.id, ...payload },
                {
                  onSuccess: () => {
                    toast.success(`Taken from ${money.goal.name}.`);
                    closeMoney();
                  },
                },
              )
            }
            onCancel={closeMoney}
          />
        ) : null}
      </Modal>

      <Modal open={deleting !== null} title="Delete goal?" size="sm" onClose={() => !deleteGoal.isPending && setDeleting(null)}>
        <p className="text-[14px] leading-relaxed text-muted">
          <span className="text-foreground">{deleting?.name}</span> will be removed and the{" "}
          <span className="num text-foreground">{deleting ? formatCents(deleting.balanceCents) : ""}</span> set aside for it
          becomes available to spend. Archive it instead to keep its history.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <Button variant="secondary" disabled={deleteGoal.isPending} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleteGoal.isPending}
            onClick={() =>
              deleting &&
              deleteGoal.mutate(deleting.id, {
                onSuccess: () => toast.success(`${deleting.name} deleted.`),
                onError: (error) => toast.error(errorMessage(error)),
                onSettled: () => setDeleting(null),
              })
            }
          >
            {deleteGoal.isPending ? "Deleting…" : "Delete goal"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="card flex h-full flex-col justify-between gap-4 p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <div>
        <p className="num text-[24px] leading-none tracking-[-0.03em]">{value}</p>
        <p className="mt-1.5 text-[12px] text-muted">{hint}</p>
      </div>
    </article>
  );
}

type CardActions = {
  onAdd: (goal: Goal) => void;
  onWithdraw: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
};

function EmergencyCard({ goal, onAdd, onWithdraw, onEdit }: CardActions & { goal: Goal }) {
  const reduceMotion = useReducedMotion();
  const info = goal.emergency!;
  const target = goal.targetAmountCents;
  const starter = info.starterTargetCents;
  const share = (cents: number) => (target && target > 0 ? Math.min(1, cents / target) : 0);
  const starterReached = starter !== null && goal.balanceCents >= starter;

  return (
    <section className="card-muted relative overflow-clip p-7 md:p-9">
      <div className="dot-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]" aria-hidden="true" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Emergency fund</p>
          <p className="mt-5 text-[48px] font-[360] leading-none tracking-[-0.045em] sm:text-[60px]">
            <span className="num">{info.monthsOfCover !== null ? info.monthsOfCover.toFixed(1) : "—"}</span>
            <span className="ml-3 text-[18px] tracking-[-0.01em] text-muted">
              of {info.targetMonths} months covered
            </span>
          </p>
          <p className="mt-3 text-[13px] text-muted">
            <span className="num text-foreground">{formatCents(goal.balanceCents)}</span>
            {target !== null ? (
              <>
                {" "}of <span className="num text-foreground">{formatCents(target)}</span> · {info.targetMonths} × your{" "}
                <span className="num">{formatCents(info.averageEssentialMonthlyCents ?? 0, 0)}</span> monthly essentials
              </>
            ) : (
              <> set aside. Mark categories as needs and record a few months of spending to size this fund.</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onAdd(goal)}>
            <Plus size={14} weight="bold" /> Add money
          </Button>
          <Button variant="secondary" onClick={() => onWithdraw(goal)} disabled={goal.balanceCents <= 0}>
            Withdraw
          </Button>
          <IconButton label="Edit emergency fund" onClick={() => onEdit(goal)}>
            <PencilSimple size={14} weight="bold" />
          </IconButton>
        </div>
      </div>

      {target !== null ? (
        <div className="relative mt-8">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: goal.color, originX: 0 }}
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: share(goal.balanceCents) }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          {starter !== null ? (
            <div className="absolute -top-1 h-4.5 w-px bg-foreground/50" style={{ left: `${share(starter) * 100}%` }} aria-hidden="true" />
          ) : null}
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-[12px] text-muted">
            <span>
              {starterReached ? "✓ " : ""}Starter buffer: 1 month ({formatCents(starter ?? 0, 0)})
            </span>
            <span>{fundingLabel(goal)} · kept in {goal.account?.name ?? "—"}</span>
          </div>
        </div>
      ) : (
        <p className="relative mt-6 text-[12px] text-muted">
          {fundingLabel(goal)} · kept in {goal.account?.name ?? "—"}
        </p>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  index,
  canMoveUp,
  canMoveDown,
  onMove,
  onArchive,
  onRestore,
  onDelete,
  onAdd,
  onWithdraw,
  onEdit,
}: CardActions & {
  goal: Goal;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (goal: Goal, direction: -1 | 1) => void;
  onArchive: (goal: Goal) => void;
  onRestore: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const reduceMotion = useReducedMotion();
  const archived = goal.archivedAt !== null;
  const status = STATUS[goal.progress.status];
  const { progress } = goal;

  let plan: ReactNode = null;
  if (progress.status === "done") {
    plan = "Target reached.";
  } else if (progress.requiredMonthlyCents && goal.targetDate) {
    plan = (
      <>
        Needs <span className="num text-foreground">{formatCents(progress.requiredMonthlyCents, 0)}</span>/month until{" "}
        {monthLabel(goal.targetDate.slice(0, 7))}
        {goal.repeatsYearly ? " (every year)" : ""}.
      </>
    );
  } else if (progress.projectedCompletion) {
    plan = <>At this pace you&rsquo;ll get there in {monthLabel(progress.projectedCompletion)}.</>;
  } else if (goal.targetAmountCents === null) {
    plan = "No target — every bit set aside counts.";
  }

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn("card flex flex-col gap-5 p-6", archived && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
            style={{ backgroundColor: `color-mix(in srgb, ${goal.color} 14%, transparent)`, color: goal.color }}
          >
            <CategoryIcon name={goal.icon} size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px]">{goal.name}</p>
            <p className="truncate text-[12px] text-muted">
              {KIND_LABEL[goal.kind]} · {goal.account?.name ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {archived ? <span className="tag bg-surface-3 text-muted">Archived</span> : null}
          {status ? <span className={cn("tag", status.className)}>{status.label}</span> : null}
        </div>
      </div>

      <div>
        <p className="text-[13px] text-muted">
          <span className="num text-[22px] tracking-[-0.02em] text-foreground">{formatCents(goal.balanceCents)}</span>
          {goal.targetAmountCents !== null ? <span className="num"> of {formatCents(goal.targetAmountCents)}</span> : null}
        </p>
        {progress.percent !== null ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: goal.color, originX: 0 }}
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: progress.percent / 100 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            />
          </div>
        ) : null}
        <p className="mt-3 text-[12px] text-muted">{plan}</p>
        <p className="mt-1 text-[12px] text-muted">{fundingLabel(goal)}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex gap-2">
          {archived ? (
            <Button size="sm" variant="secondary" onClick={() => onRestore(goal)}>
              <ArrowCounterClockwise size={12} weight="bold" /> Restore
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => onAdd(goal)}>
                <Plus size={12} weight="bold" /> Add
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onWithdraw(goal)} disabled={goal.balanceCents <= 0}>
                Withdraw
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-0.5">
          {!archived ? (
            <>
              <IconButton label={`Move ${goal.name} up`} onClick={() => onMove(goal, -1)} disabled={!canMoveUp}>
                <ArrowUp size={14} weight="bold" />
              </IconButton>
              <IconButton label={`Move ${goal.name} down`} onClick={() => onMove(goal, 1)} disabled={!canMoveDown}>
                <ArrowDown size={14} weight="bold" />
              </IconButton>
              <IconButton label={`Edit ${goal.name}`} onClick={() => onEdit(goal)}>
                <PencilSimple size={14} weight="bold" />
              </IconButton>
              <IconButton label={`Archive ${goal.name}`} onClick={() => onArchive(goal)}>
                <Archive size={14} weight="bold" />
              </IconButton>
            </>
          ) : null}
          <IconButton label={`Delete ${goal.name}`} onClick={() => onDelete(goal)} danger>
            <Trash size={14} weight="bold" />
          </IconButton>
        </div>
      </div>
    </motion.article>
  );
}

function IconButton({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors disabled:opacity-30",
        danger ? "hover:bg-red-bg hover:text-red-fg" : "hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

