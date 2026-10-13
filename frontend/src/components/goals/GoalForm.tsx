"use client";

import { useState, type FormEvent } from "react";
import { ColorPicker } from "@/components/categories/ColorPicker";
import { ChoiceGroup } from "@/components/settings/ui";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { Account } from "@/lib/api/accounts";
import type { Category } from "@/lib/api/categories";
import type { FundingRule, Goal, GoalKind, GoalPayload, GoalUpdatePayload } from "@/lib/api/goals";
import { currencySymbol, parseAmountInput } from "@/lib/utils/money";
import { Select } from "@/components/ui/Select";
import { DateInput } from "@/components/ui/DateInput";

const KINDS: Array<{ value: Exclude<GoalKind, "emergency">; label: string; hint: string }> = [
  { value: "sinking", label: "Sinking fund", hint: "A known cost with a date: insurance, a festival, a new laptop." },
  { value: "long_term", label: "Long-term goal", hint: "Something years away: a home deposit, education." },
  { value: "custom", label: "Other", hint: "Anything else worth setting money aside for." },
];

const FUNDING: Array<{ value: FundingRule; label: string }> = [
  { value: "percent_of_income", label: "% of each income" },
  { value: "fixed_monthly", label: "Fixed each month" },
  { value: "manual", label: "Only when I add money" },
];

const ICON_BY_KIND: Record<Exclude<GoalKind, "emergency">, string> = {
  sinking: "gift",
  long_term: "home",
  custom: "piggy-bank",
};

type FormState = {
  name: string;
  kind: Exclude<GoalKind, "emergency">;
  accountId: string;
  targetAmount: string;
  targetDate: string;
  repeatsYearly: boolean;
  categoryId: string;
  targetMonths: string;
  fundingRule: FundingRule;
  fundingPercent: string;
  fundingAmount: string;
  color: string;
};

function initialState(goal: Goal | undefined, defaultAccountId: string): FormState {
  return {
    name: goal?.name ?? "",
    kind: goal && goal.kind !== "emergency" ? goal.kind : "sinking",
    accountId: goal?.accountId ?? defaultAccountId,
    // The emergency target is computed, never typed.
    targetAmount: goal && goal.kind !== "emergency" && goal.targetAmountCents ? String(goal.targetAmountCents / 100) : "",
    targetDate: goal?.targetDate ?? "",
    repeatsYearly: goal?.repeatsYearly ?? false,
    categoryId: goal?.categoryId ?? "",
    targetMonths: goal?.emergency?.targetMonthsSetting ? String(goal.emergency.targetMonthsSetting) : "",
    fundingRule: goal?.fundingRule ?? "percent_of_income",
    fundingPercent: goal?.fundingPercentBps ? String(goal.fundingPercentBps / 100) : "10",
    fundingAmount: goal?.fundingAmountCents ? String(goal.fundingAmountCents / 100) : "",
    color: goal?.color ?? "#16a34a",
  };
}

export function GoalForm({
  goal,
  accounts,
  categories,
  defaultAccountId,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  goal?: Goal;
  accounts: Account[];
  categories: Category[];
  defaultAccountId: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: GoalPayload | GoalUpdatePayload) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(goal, defaultAccountId));
  const [validation, setValidation] = useState<string | null>(null);
  const isEmergency = goal?.kind === "emergency";
  const isEditing = Boolean(goal);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  // Goal money must sit in something you own.
  const assetAccounts = accounts.filter((account) => account.nature === "asset" && (account.archivedAt === null || account.id === form.accountId));
  const expenseCategories = categories.filter((category) => category.type === "expense");

  function submit(event: FormEvent) {
    event.preventDefault();
    const targetAmount = parseAmountInput(form.targetAmount);
    const fundingPercent = parseAmountInput(form.fundingPercent);
    const fundingAmount = parseAmountInput(form.fundingAmount);

    if (!isEmergency && !form.name.trim()) return setValidation("Give the goal a name.");
    if ([targetAmount, fundingPercent, fundingAmount].some((value) => value !== null && !Number.isFinite(value))) {
      return setValidation("Amounts must be numbers.");
    }
    if (form.fundingRule === "percent_of_income" && !(fundingPercent && fundingPercent > 0 && fundingPercent <= 100)) {
      return setValidation("Choose a percent between 0 and 100.");
    }
    if (form.fundingRule === "fixed_monthly" && !(fundingAmount && fundingAmount > 0)) {
      return setValidation("Choose an amount to set aside each month.");
    }
    setValidation(null);

    const funding = {
      fundingRule: form.fundingRule,
      fundingPercent: form.fundingRule === "percent_of_income" ? fundingPercent : null,
      fundingAmount: form.fundingRule === "fixed_monthly" ? fundingAmount : null,
    };

    if (isEmergency) {
      onSubmit({
        accountId: form.accountId,
        targetMonths: form.targetMonths ? Number(form.targetMonths) : null,
        ...funding,
        color: form.color,
      });
      return;
    }

    const isSinking = form.kind === "sinking";
    onSubmit({
      name: form.name.trim(),
      ...(isEditing ? {} : { kind: form.kind, icon: ICON_BY_KIND[form.kind] }),
      accountId: form.accountId,
      targetAmount,
      targetDate: form.targetDate || null,
      repeatsYearly: isSinking ? form.repeatsYearly : false,
      categoryId: isSinking ? form.categoryId || null : null,
      ...funding,
      color: form.color,
    });
  }

  const kindMeta = KINDS.find((kind) => kind.value === form.kind)!;

  return (
    <form className="space-y-6" onSubmit={submit}>
      {isEmergency ? (
        <p className="rounded-[8px] bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
          Your emergency fund is sized from what you spend on needs. Aim for 3–6 months of essentials, or 6–12 if your
          income is irregular.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div>
            <label className="label" htmlFor="goal-name">Name</label>
            <input
              id="goal-name"
              className="field"
              placeholder="New laptop"
              maxLength={100}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="goal-kind">Type</label>
            <Select
              id="goal-kind"
              className="field"
              disabled={isEditing}
              value={form.kind}
              onChange={(event) => set("kind", event.target.value as FormState["kind"])}
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="-mt-2 text-[12px] text-muted sm:col-span-2">{kindMeta.hint}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="goal-account">Kept in</label>
          <Select id="goal-account" className="field" value={form.accountId} onChange={(event) => set("accountId", event.target.value)}>
            {assetAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[12px] text-muted">A separate savings account makes the money harder to spend by accident.</p>
        </div>

        {isEmergency ? (
          <div>
            <label className="label" htmlFor="goal-months">Months of essentials to hold</label>
            <Select id="goal-months" className="field" value={form.targetMonths} onChange={(event) => set("targetMonths", event.target.value)}>
              <option value="">Automatic (from your financial profile)</option>
              {Array.from({ length: 10 }, (_, index) => index + 3).map((months) => (
                <option key={months} value={months}>
                  {months} months
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <MoneyField id="goal-target" label="Target" optional value={form.targetAmount} onChange={(value) => set("targetAmount", value)} />
        )}

        {!isEmergency ? (
          <div>
            <label className="label" htmlFor="goal-date">
              Target date <span className="text-faint">optional</span>
            </label>
            <DateInput id="goal-date" className="field" value={form.targetDate} onChange={(event) => set("targetDate", event.target.value)} />
          </div>
        ) : null}

        {form.kind === "sinking" && !isEmergency ? (
          <div>
            <label className="label" htmlFor="goal-category">
              Pays for <span className="text-faint">optional</span>
            </label>
            <Select id="goal-category" className="field" value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
              <option value="">No category</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[12px] text-muted">Expenses in this category can be paid straight from the fund.</p>
          </div>
        ) : null}
      </div>

      {form.kind === "sinking" && !isEmergency ? (
        <label className="flex items-start gap-2.5 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={form.repeatsYearly}
            onChange={(event) => set("repeatsYearly", event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--ds-foreground)]"
          />
          <span>
            Every year
            <span className="block text-[12px] text-muted">The target date moves on a year once it passes.</span>
          </span>
        </label>
      ) : null}

      <div className="space-y-3 rounded-[10px] border border-line px-4 py-4">
        <div>
          <span className="label">How is it funded?</span>
          <ChoiceGroup label="Funding" value={form.fundingRule} onChange={(value) => set("fundingRule", value)} options={FUNDING} />
        </div>
        {form.fundingRule === "percent_of_income" ? (
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <input
              aria-label="Percent of each income"
              inputMode="decimal"
              className="field num w-24"
              value={form.fundingPercent}
              onChange={(event) => set("fundingPercent", event.target.value)}
            />
            % of every income, set aside the moment you record it.
          </div>
        ) : null}
        {form.fundingRule === "fixed_monthly" ? (
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <div className="w-40">
              <MoneyField id="goal-monthly" label="" value={form.fundingAmount} onChange={(value) => set("fundingAmount", value)} />
            </div>
            each month, taken from that month&rsquo;s income.
          </div>
        ) : null}
        <p className="text-[12px] text-muted">
          {form.fundingRule === "manual"
            ? "Saving works best when it happens before you can spend the money."
            : "Pay yourself first: goals higher on the Goals page are funded first."}
        </p>
      </div>

      <div>
        <span className="label">Color</span>
        <ColorPicker value={form.color} onChange={(color) => set("color", color)} />
      </div>

      {validation || error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {validation ?? error}
        </p>
      ) : null}

      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {submitting ? "Saving…" : isEditing ? "Save goal" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}

export function MoneyField({
  id,
  label,
  value,
  optional,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      {label ? (
        <label className="label" htmlFor={id}>
          {label} {optional ? <span className="text-faint">optional</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">
          {currencySymbol()}
        </span>
        <input
          id={id}
          aria-label={label || "Amount"}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="field num pl-8"
          placeholder="0.00"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
