"use client";

import { useState, type FormEvent } from "react";
import { ChoiceGroup } from "@/components/settings/ui";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { Account } from "@/lib/api/accounts";
import type { Goal, WithdrawalReason } from "@/lib/api/goals";
import { formatCents, parseAmountInput } from "@/lib/utils/money";
import { MoneyField } from "./GoalForm";

const REASONS: Array<{ value: WithdrawalReason; label: string }> = [
  { value: "emergency", label: "An emergency" },
  { value: "planned_purchase", label: "The thing I saved for" },
  { value: "rebalancing", label: "Moving it to another goal" },
  { value: "other", label: "Something else" },
];

export type GoalMoneyAction = "add" | "withdraw";

export function GoalMoneyForm({
  goal,
  action,
  accounts,
  submitting,
  error,
  onAdd,
  onWithdraw,
  onCancel,
}: {
  goal: Goal;
  action: GoalMoneyAction;
  accounts: Account[];
  submitting: boolean;
  error: string | null;
  onAdd: (payload: { amount: number; fromAccountId: string }) => void;
  onWithdraw: (payload: { amount: number; reason: WithdrawalReason; note?: string }) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState(goal.accountId);
  const [reason, setReason] = useState<WithdrawalReason | null>(null);
  const [note, setNote] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const parsed = parseAmountInput(amount);
  const amountCents = parsed && Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  const sources = accounts.filter((account) => account.nature === "asset" && account.archivedAt === null);
  const average = goal.emergency?.averageEssentialMonthlyCents;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!amountCents || amountCents <= 0) return setValidation("Enter an amount greater than zero.");
    if (action === "withdraw") {
      if (amountCents > goal.balanceCents) return setValidation(`${goal.name} holds ${formatCents(goal.balanceCents)}.`);
      if (!reason) return setValidation("Choose why you are taking money out.");
      setValidation(null);
      onWithdraw({ amount: amountCents / 100, reason, note: note.trim() || undefined });
      return;
    }
    setValidation(null);
    onAdd({ amount: amountCents / 100, fromAccountId });
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <MoneyField id="goal-money-amount" label="Amount" value={amount} onChange={setAmount} />

      {action === "add" ? (
        <div>
          <label className="label" htmlFor="goal-money-from">From</label>
          <select id="goal-money-from" className="field" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
            {sources.map((account) => (
              <option key={account.id} value={account.id}>
                {account.id === goal.accountId ? `${account.name} (already there — just set it aside)` : account.name}
              </option>
            ))}
          </select>
          {fromAccountId !== goal.accountId ? (
            <p className="mt-1.5 text-[12px] text-muted">
              A transfer moves the money into {goal.account?.name ?? "the goal's account"}.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div>
            <span className="label">What is it for?</span>
            <ChoiceGroup label="Reason" value={reason} onChange={setReason} options={REASONS} />
          </div>
          <div>
            <label className="label" htmlFor="goal-money-note">
              Note <span className="text-faint">optional</span>
            </label>
            <input id="goal-money-note" className="field" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {goal.kind === "emergency" && average ? (
            <p className="rounded-[8px] bg-yellow-bg px-3.5 py-3 text-[13px] text-yellow-fg">
              Cover goes from <strong className="num font-medium">{(goal.balanceCents / average).toFixed(1)}</strong> to{" "}
              <strong className="num font-medium">{(Math.max(0, goal.balanceCents - amountCents) / average).toFixed(1)}</strong>{" "}
              months of essentials. Rebuild it before saving for anything else.
            </p>
          ) : null}
          <p className="text-[12px] text-muted">The money stays in {goal.account?.name ?? "its account"} and becomes available to spend.</p>
        </>
      )}

      {validation || error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {validation ?? error}
        </p>
      ) : null}

      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={action === "withdraw" ? "secondary" : "primary"} disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {action === "add" ? "Add money" : "Take money out"}
        </Button>
      </div>
    </form>
  );
}
