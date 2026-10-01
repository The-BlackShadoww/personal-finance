"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAccountSummary, useSetupAccount } from "@/lib/hooks/useAccount";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { currencySymbol } from "@/lib/utils/money";
import { Notice, SectionTitle } from "./ui";

export function AccountSettingsTab() {
  const { data: summary, isLoading } = useAccountSummary();
  const setup = useSetupAccount();
  const [initialBalance, setInitialBalance] = useState(0);
  const [threshold, setThreshold] = useState(5000);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The field edits the default account's opening balance, not the sum
  // across accounts that the summary reports.
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const defaultOpeningCents = accountsData?.accounts.find((account) => account.isDefault)?.openingBalanceCents;

  useEffect(() => {
    if (summary) setThreshold(summary.lowBalanceThresholdCents / 100);
  }, [summary]);

  useEffect(() => {
    if (defaultOpeningCents !== undefined) setInitialBalance(defaultOpeningCents / 100);
  }, [defaultOpeningCents]);

  if (isLoading || accountsLoading)
    return (
      <div className="max-w-2xl space-y-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-48" />
      </div>
    );

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await setup.mutateAsync({
        initialBalance: Math.round(initialBalance),
        lowBalanceThreshold: Math.round(threshold),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save configuration");
    }
  }

  return (
    <div className="max-w-2xl space-y-12">
      <section>
        <SectionTitle
          title="Account configuration"
          description="Balances are recalculated from each account's opening balance and every transaction. The alert compares against money available to spend — after goals."
        />
        <form onSubmit={saveConfig} className="grid gap-5 sm:grid-cols-2">
          <NumberInput id="initial-balance" label="Default account opening balance" prefix={currencySymbol()} value={initialBalance} onChange={setInitialBalance} />
          <NumberInput id="threshold" label="Low-balance threshold" prefix={currencySymbol()} value={threshold} onChange={setThreshold} />
          <div className="space-y-3 sm:col-span-2">
            <Notice show={Boolean(error)} tone="error">
              {error}
            </Notice>
            <Notice show={saved} tone="success">
              Configuration saved.
            </Notice>
            <Button type="submit" disabled={setup.isPending}>
              {setup.isPending ? <Spinner /> : null}
              {setup.isPending ? "Saving…" : "Save configuration"}
            </Button>
          </div>
        </form>
      </section>

      <section className="border-t border-line pt-10">
        <SectionTitle
          title="Accounts and goals"
          description="Savings sectors became goals: real money set aside inside your accounts, funded automatically from income if you like."
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/accounts" className="text-[14px] text-foreground underline underline-offset-4">
            Manage accounts
          </Link>
          <span className="text-muted">·</span>
          <Link href="/goals" className="text-[14px] text-foreground underline underline-offset-4">
            Manage goals
          </Link>
        </div>
      </section>
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  prefix,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="label">{label}</span>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">{prefix}</span>
        ) : null}
        <input
          id={id}
          type="number"
          required
          min={min}
          max={max}
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`field num ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">{suffix}</span>
        ) : null}
      </div>
    </label>
  );
}
