"use client";

import { Hourglass, Plus, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { MoneyField } from "@/components/goals/GoalForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { WishlistItem } from "@/lib/api/wishlist";
import { useCategories } from "@/lib/hooks/useCategories";
import { useContributeToGoal, useGoals } from "@/lib/hooks/useGoals";
import {
  useAddWishlistItem,
  useDecideWishlistItem,
  useRemoveWishlistItem,
  useWishlist,
} from "@/lib/hooks/useHabits";
import { formatCents, parseAmountInput } from "@/lib/utils/money";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/** "2 days left", "5 hours left". */
function timeLeft(coolUntil: string) {
  const hours = Math.max(0, Math.ceil((new Date(coolUntil).getTime() - Date.now()) / 3_600_000));
  if (hours >= 48) return `${Math.ceil(hours / 24)} days left`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
}

/**
 * The cooling-off list (B2): wants wait before they are bought. Once the
 * wait is over, buy (records the expense) or skip — and skipped money can
 * go to a goal.
 */
export function CoolingOffPanel() {
  const { data, isLoading } = useWishlist();
  const decide = useDecideWishlistItem();
  const remove = useRemoveWishlistItem();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState<WishlistItem | null>(null);
  const [settingAside, setSettingAside] = useState<WishlistItem | null>(null);

  if (isLoading || !data) return <div className="skeleton h-40" />;

  const { pending, decided, summary, settings } = data;

  function skip(item: WishlistItem) {
    decide.mutate(
      { id: item.id, decision: "skipped" },
      {
        onSuccess: () =>
          toast.success(`Skipped ${item.name}. ${formatCents(item.amountCents, 0)} stays yours.`, {
            label: "Set aside for a goal",
            onClick: () => setSettingAside(item),
          }),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px]">Cooling-off list</h2>
          <p className="text-[13px] text-muted">
            Wants wait {settings.hours % 24 === 0 ? `${settings.hours / 24} days` : `${settings.hours} hours`} before you buy.
            Most urges pass.{" "}
            {settings.thresholdCents === null ? (
              <Link href="/settings?tab=financial" className="underline underline-offset-2">
                Turn on the rule
              </Link>
            ) : (
              <>Expenses above {formatCents(settings.thresholdCents, 0)} offer it automatically.</>
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={13} weight="bold" /> Add a want
        </Button>
      </div>

      {summary.skippedThisYearCents > 0 ? (
        <div className="card-muted px-6 py-5">
          <p className="text-[15px] text-foreground">
            You skipped <span className="num">{formatCents(summary.skippedThisYearCents, 0)}</span> of impulse buys in{" "}
            {summary.year}.
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {summary.skippedThisYearCount} {summary.skippedThisYearCount === 1 ? "thing" : "things"} you decided you could
            live without. Put the money toward something you do want.
          </p>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {pending.length ? (
          <ul className="divide-y divide-line">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-muted">
                  <Hourglass size={14} weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                        {item.name}
                      </a>
                    ) : (
                      item.name
                    )}
                  </p>
                  <p className="text-[12px] text-muted">
                    {item.ready ? "The wait is over. Still want it?" : timeLeft(item.coolUntil)}
                  </p>
                </div>
                <p className="num text-[14px]">{formatCents(item.amountCents)}</p>
                <div className="flex gap-1.5">
                  {item.ready ? (
                    <Button size="sm" onClick={() => setBuying(item)}>
                      Buy
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => skip(item)}>
                    Skip
                  </Button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    title="Remove"
                    onClick={() => remove.mutate(item.id)}
                    className="grid h-8 w-8 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <Trash size={13} weight="bold" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-8 text-[13px] text-muted">
            Nothing waiting. Next time you want something that isn&apos;t essential, put it here and decide in a couple of days.
          </p>
        )}
        {decided.length ? (
          <details className="border-t border-line px-6 py-4">
            <summary className="cursor-pointer text-[13px] text-muted">Decided recently</summary>
            <ul className="mt-3 space-y-2 text-[13px]">
              {decided.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {item.name} <span className="text-muted">· {item.decision === "skipped" ? "skipped" : "bought"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {item.decision === "skipped" ? (
                      <button type="button" className="text-[12px] text-muted underline underline-offset-2" onClick={() => setSettingAside(item)}>
                        Set aside
                      </button>
                    ) : null}
                    <span className="num">{formatCents(item.amountCents, 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <Modal open={adding} title="Add a want" description="It waits on the list before you can buy it." onClose={() => setAdding(false)}>
        {adding ? <AddWantForm onDone={() => setAdding(false)} /> : null}
      </Modal>

      <Modal
        open={buying !== null}
        title={buying ? `Buy ${buying.name}` : "Buy"}
        description="Record the expense. The item moves to Decided."
        onClose={() => setBuying(null)}
      >
        {buying ? (
          <TransactionForm
            prefill={{ amount: buying.amountCents / 100, categoryId: buying.categoryId, note: buying.name }}
            onCancel={() => setBuying(null)}
            onSuccess={() => setBuying(null)}
            onCreated={(created) =>
              decide.mutate(
                { id: buying.id, decision: "bought", transactionId: created.id },
                { onError: (error) => toast.error(errorMessage(error)) },
              )
            }
          />
        ) : null}
      </Modal>

      <Modal
        open={settingAside !== null}
        title="Set it aside for a goal"
        description="The money is still in your account; this earmarks it so it is not spent elsewhere."
        size="sm"
        onClose={() => setSettingAside(null)}
      >
        {settingAside ? <SetAsideForm item={settingAside} onDone={() => setSettingAside(null)} /> : null}
      </Modal>
    </section>
  );
}

function AddWantForm({ onDone }: { onDone: () => void }) {
  const { data: categories = [] } = useCategories();
  const add = useAddWishlistItem();
  const toast = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const wants = categories.filter((category) => category.type === "expense" && !category.essential);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmountInput(amount);
    if (!name.trim()) return setValidation("What is it?");
    if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return setValidation("Enter its price.");
    if (url.trim() && !/^https?:\/\//i.test(url.trim())) return setValidation("Links start with http:// or https://");
    setValidation(null);
    add.mutate(
      { name: name.trim(), amount: Math.round(parsed * 100) / 100, url: url.trim() || undefined, categoryId: categoryId || undefined },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} added. Decide once the wait is over.`);
          onDone();
        },
      },
    );
  }

  const error = validation ?? (add.error instanceof Error ? add.error.message : null);

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <label className="label" htmlFor="want-name">What is it?</label>
        <input id="want-name" className="field" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <MoneyField id="want-amount" label="Price" value={amount} onChange={setAmount} />
      <div>
        <label className="label" htmlFor="want-category">
          Category <span className="text-faint">optional</span>
        </label>
        <select id="want-category" className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Choose later</option>
          {wants.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="want-url">
          Link <span className="text-faint">optional</span>
        </label>
        <input id="want-url" className="field" type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </div>
      {error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {error}
        </p>
      ) : null}
      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onDone} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? <Spinner /> : null}
          Add to list
        </Button>
      </div>
    </form>
  );
}

function SetAsideForm({ item, onDone }: { item: WishlistItem; onDone: () => void }) {
  const { data } = useGoals();
  const contribute = useContributeToGoal();
  const toast = useToast();
  const goals = (data?.goals ?? []).filter((goal) => goal.archivedAt === null);
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const goal = goals.find((option) => option.id === goalId);

  if (!goals.length) {
    return (
      <p className="text-[13px] text-muted">
        No goals yet. Create one on this page, then set skipped money aside for it.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted">
        Add <span className="num text-foreground">{formatCents(item.amountCents)}</span> — what {item.name} would have cost — to:
      </p>
      <select className="field" aria-label="Goal" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
        {goals.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {contribute.error instanceof Error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {contribute.error.message}
        </p>
      ) : null}
      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onDone} disabled={contribute.isPending}>
          Not now
        </Button>
        <Button
          disabled={contribute.isPending || !goal}
          onClick={() =>
            goal &&
            contribute.mutate(
              { id: goal.id, amount: item.amountCents / 100, fromAccountId: goal.accountId },
              {
                onSuccess: () => {
                  toast.success(`${formatCents(item.amountCents, 0)} set aside for ${goal.name}.`);
                  onDone();
                },
              },
            )
          }
        >
          {contribute.isPending ? <Spinner /> : null}
          Set aside
        </Button>
      </div>
    </div>
  );
}
