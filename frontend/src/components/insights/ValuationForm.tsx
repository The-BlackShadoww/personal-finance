"use client";

import { useState, type FormEvent } from "react";
import { MoneyField } from "@/components/goals/GoalForm";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useUpsertValuation } from "@/lib/hooks/useAccounts";
import { formatCents, parseAmountInput } from "@/lib/utils/money";

/** Today in the viewer's timezone, as "YYYY-MM-DD". */
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Records what an investment, retirement or property account is worth. */
export function ValuationForm({
  account,
  onDone,
  onCancel,
}: {
  /** `lastValuation` undefined means unknown here; null means never valued. */
  account: { id: string; name: string; lastValuation?: { date: string; valueCents: number } | null };
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = localToday();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const upsert = useUpsertValuation();
  const toast = useToast();

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmountInput(value);
    if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return setValidation("Enter what the account is worth.");
    if (!date || date > today) return setValidation("Choose a date that is not in the future.");
    setValidation(null);
    upsert.mutate(
      { id: account.id, payload: { date, value: Math.round(parsed * 100) / 100, note: note.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success(`${account.name} updated.`);
          onDone();
        },
      },
    );
  }

  const error = validation ?? (upsert.error instanceof Error ? upsert.error.message : null);

  return (
    <form className="space-y-6" onSubmit={submit}>
      <p className="text-[13px] leading-relaxed text-muted">
        {account.lastValuation === undefined
          ? null
          : account.lastValuation
            ? `Last valued at ${formatCents(account.lastValuation.valueCents)} on ${account.lastValuation.date}. `
            : "Not valued yet: net worth counts only what you put in. "}
        Money you move in or out after this date is added on top until the next update.
      </p>
      <MoneyField id="valuation-value" label="Current value" value={value} onChange={setValue} />
      <div>
        <label className="label" htmlFor="valuation-date">As of</label>
        <input id="valuation-date" type="date" className="field num" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="valuation-note">
          Note <span className="text-faint">optional</span>
        </label>
        <input id="valuation-note" className="field" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      {error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {error}
        </p>
      ) : null}

      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onCancel} disabled={upsert.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={upsert.isPending}>
          {upsert.isPending ? <Spinner /> : null}
          Save value
        </Button>
      </div>
    </form>
  );
}
