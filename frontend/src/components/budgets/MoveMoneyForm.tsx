"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { BudgetItem, PlanCategory } from "@/lib/api/budgets";
import { formatCents, parseAmountInput } from "@/lib/utils/money";
import { MoneyField } from "@/components/goals/GoalForm";

/**
 * Covers an overspent category by moving budget from one with room left —
 * rebalancing the plan rather than pretending the overspend didn't happen.
 */
export function MoveMoneyForm({
  target,
  categories,
  saving,
  onSubmit,
  onCancel,
}: {
  target: PlanCategory;
  categories: PlanCategory[];
  saving: boolean;
  onSubmit: (items: BudgetItem[]) => void;
  onCancel: () => void;
}) {
  const sources = categories.filter(
    (category) => category.categoryId !== target.categoryId && (category.remainingCents ?? 0) > 0 && category.amountCents !== null,
  );
  const shortfall = Math.max(0, -(target.remainingCents ?? 0));
  const [sourceId, setSourceId] = useState(sources[0]?.categoryId ?? "");
  const source = sources.find((category) => category.categoryId === sourceId);
  const [amount, setAmount] = useState(() =>
    String(Math.min(shortfall, sources[0]?.remainingCents ?? 0) / 100),
  );
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmountInput(amount);
    const cents = parsed !== null && Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    if (!source || cents <= 0) return setError("Choose a category and an amount.");
    if (cents > (source.remainingCents ?? 0)) {
      return setError(`${source.name} has ${formatCents(source.remainingCents ?? 0)} left.`);
    }
    onSubmit([
      { categoryId: source.categoryId, amount: ((source.amountCents ?? 0) - cents) / 100, rollover: source.rollover },
      { categoryId: target.categoryId, amount: ((target.amountCents ?? 0) + cents) / 100, rollover: target.rollover },
    ]);
  }

  if (!sources.length) {
    return (
      <div className="space-y-6">
        <p className="text-[14px] text-muted">
          No other category has budget left this month. Raise {target.name}&rsquo;s budget, or plan a smaller amount next
          month.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <p className="text-[14px] text-muted">
        {target.name} is <span className="num text-foreground">{formatCents(shortfall)}</span> over. Overspending happens —
        move budget from a category with room so the plan stays honest.
      </p>
      <div>
        <label className="label" htmlFor="move-source">From</label>
        <select id="move-source" className="field" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
          {sources.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.name} — {formatCents(category.remainingCents ?? 0)} left
            </option>
          ))}
        </select>
      </div>
      <MoneyField id="move-amount" label="Amount" value={amount} onChange={setAmount} />
      {error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {error}
        </p>
      ) : null}
      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          Move money
        </Button>
      </div>
    </form>
  );
}
