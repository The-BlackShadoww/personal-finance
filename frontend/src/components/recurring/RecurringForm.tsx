"use client";

import { useState, type FormEvent } from "react";
import { MoneyField } from "@/components/goals/GoalForm";
import { ChoiceGroup } from "@/components/settings/ui";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import type { Account } from "@/lib/api/accounts";
import type { Category } from "@/lib/api/categories";
import type { Frequency, RecurringPayload, RecurringRule } from "@/lib/api/recurring";
import type { TransactionType } from "@/lib/api/transactions";
import { parseAmountInput } from "@/lib/utils/money";
import { Select } from "@/components/ui/Select";
import { DateInput } from "@/components/ui/DateInput";

const FREQUENCIES: Array<{ value: Frequency; label: string }> = [
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Every year" },
];

type FormState = {
  name: string;
  type: TransactionType;
  amount: string;
  accountId: string;
  counterAccountId: string;
  categoryId: string;
  frequency: Frequency;
  anchorDate: string;
  endDate: string;
  periodOffsetMonths: number;
  autoPost: boolean;
  isSubscription: boolean;
  note: string;
};

type Template = { label: string; hint: string; apply: (state: FormState, ctx: TemplateContext) => FormState };
type TemplateContext = { categoryByName: (name: string) => string; investAccount?: string; debtAccount?: string };

// Common schedules, so setting up payday automation takes one tap.
const TEMPLATES: Template[] = [
  {
    label: "Salary",
    hint: "Posts on payday; your goals take their share automatically.",
    apply: (s, c) => ({ ...s, name: s.name || "Salary", type: "income", categoryId: c.categoryByName("Salary"), frequency: "monthly", autoPost: true, isSubscription: false }),
  },
  {
    label: "Bill",
    hint: "Rent, utilities: asks you to confirm the amount each time.",
    apply: (s, c) => ({ ...s, name: s.name || "Rent", type: "expense", categoryId: c.categoryByName("Rent"), frequency: "monthly", autoPost: false, isSubscription: false }),
  },
  {
    label: "Subscription",
    hint: "Streaming, apps: counted in your yearly subscription total.",
    apply: (s, c) => ({ ...s, type: "expense", categoryId: c.categoryByName("Subscriptions"), frequency: "monthly", autoPost: true, isSubscription: true }),
  },
  {
    label: "Invest every payday",
    hint: "A transfer into an investment account on a schedule.",
    apply: (s, c) => ({ ...s, name: s.name || "Invest", type: "transfer", counterAccountId: c.investAccount ?? "", categoryId: "", frequency: "monthly", autoPost: true, isSubscription: false }),
  },
  {
    label: "Pay down debt",
    hint: "A fixed payment to a card or loan each month.",
    apply: (s, c) => ({ ...s, name: s.name || "Debt payment", type: "transfer", counterAccountId: c.debtAccount ?? "", categoryId: "", frequency: "monthly", autoPost: false, isSubscription: false }),
  },
];

const today = () => new Date().toISOString().slice(0, 10);

function initialState(rule: RecurringRule | undefined, initial: Partial<RecurringPayload> | undefined, defaultAccountId: string): FormState {
  return {
    name: rule?.name ?? initial?.name ?? "",
    type: rule?.type ?? initial?.type ?? "expense",
    amount: rule ? String(rule.amountCents / 100) : initial?.amount ? String(initial.amount) : "",
    accountId: rule?.accountId ?? initial?.accountId ?? defaultAccountId,
    counterAccountId: rule?.counterAccountId ?? initial?.counterAccountId ?? "",
    categoryId: rule?.categoryId ?? initial?.categoryId ?? "",
    frequency: rule?.frequency ?? initial?.frequency ?? "monthly",
    anchorDate: rule?.anchorDate ?? initial?.anchorDate ?? today(),
    endDate: rule?.endDate ?? "",
    periodOffsetMonths: rule?.periodOffsetMonths ?? 0,
    autoPost: rule?.autoPost ?? initial?.autoPost ?? false,
    isSubscription: rule?.isSubscription ?? false,
    note: rule?.note ?? initial?.note ?? "",
  };
}

export function RecurringForm({
  rule,
  initial,
  accounts,
  categories,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  rule?: RecurringRule;
  /** Prefill from an existing entry ("Make recurring"). */
  initial?: Partial<RecurringPayload>;
  accounts: Account[];
  categories: Category[];
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: RecurringPayload) => void;
  onCancel: () => void;
}) {
  const active = accounts.filter((account) => account.archivedAt === null || account.id === rule?.accountId || account.id === rule?.counterAccountId);
  const defaultAccountId = active.find((account) => account.isDefault)?.id ?? active[0]?.id ?? "";
  const [form, setForm] = useState<FormState>(() => initialState(rule, initial, defaultAccountId));
  const [validation, setValidation] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const isTransfer = form.type === "transfer";
  const typedCategories = categories.filter((category) => category.type === form.type);
  const context: TemplateContext = {
    categoryByName: (name) => categories.find((category) => category.name === name)?.id ?? "",
    investAccount: active.find((account) => account.kind === "investment" || account.kind === "retirement")?.id,
    debtAccount: active.find((account) => account.nature === "liability")?.id,
  };

  function changeType(type: TransactionType) {
    setForm((current) => ({
      ...current,
      type,
      categoryId: "",
      counterAccountId: "",
      isSubscription: type === "expense" ? current.isSubscription : false,
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAmountInput(form.amount);
    if (!form.name.trim()) return setValidation("Give it a name, e.g. Salary or Rent.");
    if (!amount || !Number.isFinite(amount) || amount <= 0) return setValidation("Enter an amount greater than zero.");
    if (isTransfer && !form.counterAccountId) return setValidation("Choose where the money goes.");
    if (!isTransfer && !form.categoryId) return setValidation("Choose a category.");
    if (form.endDate && form.endDate < form.anchorDate) return setValidation("The end date is before the first date.");
    setValidation(null);

    onSubmit({
      name: form.name.trim(),
      type: form.type,
      amount,
      accountId: form.accountId,
      ...(isTransfer ? { counterAccountId: form.counterAccountId } : { categoryId: form.categoryId }),
      frequency: form.frequency,
      anchorDate: form.anchorDate,
      endDate: form.endDate || null,
      periodOffsetMonths: form.periodOffsetMonths,
      autoPost: form.autoPost,
      isSubscription: form.type === "expense" && form.isSubscription,
      note: form.note.trim() || undefined,
      ...(initial?.fromTransactionId ? { fromTransactionId: initial.fromTransactionId } : {}),
    });
  }

  const accountOptions = (exclude?: string) =>
    [
      { label: "Money you own", items: active.filter((a) => a.nature === "asset" && a.id !== exclude) },
      { label: "Money you owe", items: active.filter((a) => a.nature === "liability" && a.id !== exclude) },
    ]
      .filter((group) => group.items.length)
      .map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </optgroup>
      ));

  return (
    <form className="space-y-6" onSubmit={submit}>
      {!rule && !initial ? (
        <div>
          <span className="label">Start from</span>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                title={template.hint}
                onClick={() => setForm((current) => template.apply(current, context))}
                className="rounded-[8px] border border-line-strong px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <SegmentedControl
        label="Type"
        fullWidth
        value={form.type}
        onChange={changeType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
          { value: "transfer", label: "Transfer" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rule-name">Name</label>
          <input id="rule-name" className="field" maxLength={100} placeholder="Salary" value={form.name} onChange={(event) => set("name", event.target.value)} />
        </div>
        <MoneyField id="rule-amount" label="Amount" value={form.amount} onChange={(value) => set("amount", value)} />

        <div>
          <label className="label" htmlFor="rule-account">{isTransfer ? "From" : form.type === "income" ? "Received in" : "Paid from"}</label>
          <Select id="rule-account" className="field" value={form.accountId} onChange={(event) => set("accountId", event.target.value)}>
            {accountOptions()}
          </Select>
        </div>
        {isTransfer ? (
          <div>
            <label className="label" htmlFor="rule-to">To</label>
            <Select id="rule-to" className="field" value={form.counterAccountId} onChange={(event) => set("counterAccountId", event.target.value)}>
              <option value="">Choose an account</option>
              {accountOptions(form.accountId)}
            </Select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="rule-category">Category</label>
            <Select id="rule-category" className="field" value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
              <option value="">Choose a category</option>
              {typedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="rule-frequency">How often</label>
          <Select id="rule-frequency" className="field" value={form.frequency} onChange={(event) => set("frequency", event.target.value as Frequency)}>
            {FREQUENCIES.map((frequency) => (
              <option key={frequency.value} value={frequency.value}>
                {frequency.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="rule-anchor">First date</label>
          <DateInput id="rule-anchor" className="field" value={form.anchorDate} onChange={(event) => set("anchorDate", event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="rule-end">
            Ends <span className="text-faint">optional</span>
          </label>
          <DateInput id="rule-end" className="field" value={form.endDate} onChange={(event) => set("endDate", event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="rule-period">Counts toward</label>
          <Select id="rule-period" className="field" value={form.periodOffsetMonths} onChange={(event) => set("periodOffsetMonths", Number(event.target.value))}>
            <option value={-1}>The previous month (e.g. rent paid on the 1st)</option>
            <option value={0}>The same month</option>
            <option value={1}>The next month (e.g. salary paid early)</option>
          </Select>
        </div>
      </div>

      <div>
        <span className="label">When it&rsquo;s due</span>
        <ChoiceGroup
          label="Posting"
          value={form.autoPost}
          onChange={(value) => set("autoPost", value)}
          options={[
            { value: true, label: "Record it automatically" },
            { value: false, label: "Ask me to confirm" },
          ]}
        />
        <p className="mt-1.5 text-[12px] text-muted">
          {form.autoPost
            ? "Fixed amounts like salary or a subscription. Automatic is how saving on payday happens without willpower."
            : "Amounts that vary, like utilities: it waits under Due until you confirm or skip."}
        </p>
      </div>

      {form.type === "expense" ? (
        <label className="flex items-start gap-2.5 text-[13px] text-foreground">
          <input type="checkbox" checked={form.isSubscription} onChange={(event) => set("isSubscription", event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--ds-foreground)]" />
          <span>
            This is a subscription
            <span className="block text-[12px] text-muted">Counted in your yearly subscription total, to keep them in view.</span>
          </span>
        </label>
      ) : null}

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
          {rule ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}
