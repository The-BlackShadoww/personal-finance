"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ColorPicker, PRESET_COLORS } from "@/components/categories/ColorPicker";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { Account, AccountKind, AccountPayload, AssetClass } from "@/lib/api/accounts";
import { ACCOUNT_KINDS, ASSET_CLASSES, ASSET_KINDS, LIABILITY_KINDS } from "@/lib/accounts";
import { currencySymbol, parseAmountInput } from "@/lib/utils/money";

type FormState = {
  name: string;
  kind: AccountKind;
  openingBalance: string;
  isLiquid: boolean;
  isDefault: boolean;
  interestRate: string;
  minimumPayment: string;
  creditLimit: string;
  assetClass: AssetClass | "";
  expenseRatio: string;
  color: string;
};

const fromCents = (cents: number | null) => (cents === null ? "" : String(cents / 100));
const fromBps = (bps: number | null) => (bps === null ? "" : String(bps / 100));

function initialState(account?: Account): FormState {
  if (!account) {
    return {
      name: "",
      kind: "bank",
      openingBalance: "",
      isLiquid: ACCOUNT_KINDS.bank.liquid,
      isDefault: false,
      interestRate: "",
      minimumPayment: "",
      creditLimit: "",
      assetClass: "",
      expenseRatio: "",
      color: PRESET_COLORS[0],
    };
  }
  return {
    name: account.name,
    kind: account.kind,
    openingBalance: fromCents(account.openingBalanceCents),
    isLiquid: account.isLiquid,
    isDefault: account.isDefault,
    interestRate: fromBps(account.interestRateBps),
    minimumPayment: fromCents(account.minimumPaymentCents),
    creditLimit: fromCents(account.creditLimitCents),
    assetClass: account.assetClass ?? "",
    expenseRatio: fromBps(account.expenseRatioBps),
    color: account.color,
  };
}

export function AccountForm({
  account,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  account?: Account;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: AccountPayload) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(account));
  const [validation, setValidation] = useState<string | null>(null);
  const meta = ACCOUNT_KINDS[form.kind];
  const isLiability = meta.nature === "liability";
  const isEditing = Boolean(account);
  // Kinds of the other nature are hidden when editing: an account cannot
  // switch between owned and owed.
  const kindGroups = [
    { label: "Money you own", kinds: ASSET_KINDS },
    { label: "Money you owe", kinds: LIABILITY_KINDS },
  ].filter((group) => !isEditing || group.kinds.includes(account!.kind));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function changeKind(kind: AccountKind) {
    setForm((current) => ({
      ...current,
      kind,
      // Follow the kind's default until the user has an account to edit.
      isLiquid: isEditing ? current.isLiquid : ACCOUNT_KINDS[kind].liquid,
      isDefault: ACCOUNT_KINDS[kind].nature === "liability" ? false : current.isDefault,
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const numbers = {
      openingBalance: parseAmountInput(form.openingBalance),
      interestRate: parseAmountInput(form.interestRate),
      minimumPayment: parseAmountInput(form.minimumPayment),
      creditLimit: parseAmountInput(form.creditLimit),
      expenseRatio: parseAmountInput(form.expenseRatio),
    };
    if (!form.name.trim()) return setValidation("Give the account a name.");
    if (Object.values(numbers).some((value) => value !== null && !Number.isFinite(value))) {
      return setValidation("Amounts and rates must be numbers.");
    }
    setValidation(null);

    onSubmit({
      name: form.name.trim(),
      kind: form.kind,
      openingBalance: numbers.openingBalance ?? 0,
      isLiquid: isLiability ? false : form.isLiquid,
      ...(isLiability ? {} : { isDefault: form.isDefault }),
      interestRate: numbers.interestRate,
      minimumPayment: isLiability ? numbers.minimumPayment : null,
      creditLimit: form.kind === "credit_card" ? numbers.creditLimit : null,
      assetClass: form.kind === "investment" || form.kind === "retirement" ? form.assetClass || null : null,
      expenseRatio: form.kind === "investment" || form.kind === "retirement" ? numbers.expenseRatio : null,
      color: form.color,
      icon: meta.icon,
    });
  }

  const balanceLabel = isLiability
    ? isEditing
      ? "Owed before your first recorded transaction"
      : "Amount owed today"
    : isEditing
      ? "Balance before your first recorded transaction"
      : "Current balance";

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="account-name">Name</label>
          <input
            id="account-name"
            className="field"
            placeholder={isLiability ? "Visa card" : "Salary account"}
            value={form.name}
            maxLength={100}
            onChange={(event) => set("name", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="account-kind">Type</label>
          <select
            id="account-kind"
            className="field"
            value={form.kind}
            onChange={(event) => changeKind(event.target.value as AccountKind)}
          >
            {kindGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {ACCOUNT_KINDS[kind].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-muted">{meta.hint}</p>
        </div>
      </div>

      <MoneyField id="account-balance" label={balanceLabel} value={form.openingBalance} onChange={(v) => set("openingBalance", v)} />

      {!isLiability ? (
        <div className="space-y-3">
          <Checkbox
            checked={form.isLiquid}
            onChange={(checked) => set("isLiquid", checked)}
            label="Available to spend"
            hint="You could use this money within a few days without penalty. Counts toward your available balance and emergency cover."
          />
          {!account?.isDefault ? (
            <Checkbox
              checked={form.isDefault}
              onChange={(checked) => set("isDefault", checked)}
              label="Use as the default account"
              hint="New income and expenses go here unless you pick another account."
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PercentField
          id="account-rate"
          label={isLiability ? "Interest rate (APR)" : "Interest or yield"}
          value={form.interestRate}
          onChange={(v) => set("interestRate", v)}
          hint={isLiability ? "Used to plan which debt to pay off first." : "Optional."}
        />
        {isLiability ? (
          <MoneyField id="account-minimum" label="Minimum monthly payment" value={form.minimumPayment} onChange={(v) => set("minimumPayment", v)} />
        ) : null}
        {form.kind === "credit_card" ? (
          <MoneyField id="account-limit" label="Credit limit" value={form.creditLimit} onChange={(v) => set("creditLimit", v)} />
        ) : null}
        {form.kind === "investment" || form.kind === "retirement" ? (
          <>
            <div>
              <label className="label" htmlFor="account-asset-class">Mostly invested in</label>
              <select
                id="account-asset-class"
                className="field"
                value={form.assetClass}
                onChange={(event) => set("assetClass", event.target.value as AssetClass | "")}
              >
                <option value="">Not set</option>
                {ASSET_CLASSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <PercentField
              id="account-fee"
              label="Annual fee (expense ratio)"
              value={form.expenseRatio}
              onChange={(v) => set("expenseRatio", v)}
              hint="Small differences compound over decades."
            />
          </>
        ) : null}
      </div>

      <div>
        <span className="label">Color</span>
        <div className="flex items-center gap-4">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
            style={{ backgroundColor: `color-mix(in srgb, ${form.color} 14%, transparent)`, color: form.color }}
          >
            <CategoryIcon name={meta.icon} size={16} />
          </span>
          <ColorPicker value={form.color} onChange={(color) => set("color", color)} />
        </div>
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
          {submitting ? "Saving…" : isEditing ? "Save account" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">
          {currencySymbol()}
        </span>
        <input
          id={id}
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

function PercentField({
  id,
  label,
  value,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="field num pr-8"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">%</span>
      </div>
      {hint ? <p className="mt-1.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Checkbox({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-[13px] text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--ds-foreground)]"
      />
      <span>
        {label}
        {hint ? <span className="block text-[12px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
