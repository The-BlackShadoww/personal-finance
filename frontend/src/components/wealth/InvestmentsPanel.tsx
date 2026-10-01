"use client";

import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/dashboard/primitives";
import { Stat } from "@/components/wealth/Stat";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { AssetClass } from "@/lib/api/accounts";
import type { WealthOverview } from "@/lib/api/wealth";
import { ASSET_CLASSES, assetClassLabel } from "@/lib/accounts";
import { useSetTargetAllocation } from "@/lib/hooks/useWealth";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

const ADVICE: Record<WealthOverview["investments"]["allocation"]["advice"], string | null> = {
  none: null,
  at_yearly_review: "Your mix has drifted more than 5 points from the target. Rebalance at your yearly review.",
  now: "Your mix has drifted more than 10 points from the target. Consider rebalancing now — direct new money to the classes that are under target first.",
};

const pct = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`);

/** Returns, allocation against a target mix, fees and contribution habit. */
export function InvestmentsPanel({ data }: { data: WealthOverview }) {
  const { investments } = data;
  const [editingTargets, setEditingTargets] = useState(false);

  if (!investments.accounts.length) {
    return (
      <Panel title="Investments" subtitle="Investment and retirement accounts">
        <p className="text-[14px] text-muted">
          No investment or retirement accounts yet.{" "}
          <Link href="/accounts" className="text-foreground underline underline-offset-4">
            Add one
          </Link>{" "}
          with its asset class and fund fee, then move money in with a transfer and update its value now and then.
        </p>
      </Panel>
    );
  }

  const advice = ADVICE[investments.allocation.advice];
  const unvalued = investments.accounts.filter((account) => !account.hasValuation);
  const unclassified = investments.accounts.filter((account) => !account.assetClassSet);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Invested" value={formatCents(investments.totalCents, 0)} />
        <Stat
          label="Return, last 12 months"
          value={pct(investments.returnPercent)}
          note={unvalued.length ? "Update values for a true return" : "Gains after money moved in"}
        />
        <Stat
          label="Fees each year"
          value={formatCents(investments.annualFeesCents, 0)}
          note={
            investments.feeDrag20yCents > 0
              ? `~${formatCents(investments.feeDrag20yCents, 0)} over 20 years vs a 0.2% fund`
              : "From each account's fund fee"
          }
        />
        <Stat
          label="Months invested"
          value={`${investments.contributionMonths} of 12`}
          note="Investing every month smooths out the ups and downs"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel
          className="lg:col-span-6"
          title="Asset mix"
          subtitle={investments.targets.length ? "Current share against your target" : "Set a target mix to see drift"}
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditingTargets(true)}>
              {investments.targets.length ? "Edit target" : "Set target"}
            </Button>
          }
        >
          <ul className="space-y-4">
            {investments.allocation.rows.map((row) => (
              <li key={row.assetClass}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span>{assetClassLabel(row.assetClass)}</span>
                  <span className="num text-muted">
                    <span className="text-foreground">{row.percent.toFixed(1)}%</span>
                    {row.targetPercent !== null ? ` · target ${row.targetPercent}%` : ""}
                    {row.driftPoints !== null && Math.abs(row.driftPoints) >= 0.1 ? (
                      <span className={cn("ml-1", Math.abs(row.driftPoints) > 5 && "text-yellow-fg")}>
                        ({row.driftPoints > 0 ? "+" : ""}
                        {row.driftPoints.toFixed(1)})
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="relative mt-2 h-[6px] rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[var(--ds-series-net)]" style={{ width: `${Math.min(100, row.percent)}%` }} />
                  {row.targetPercent !== null ? (
                    <span
                      className="absolute -top-1 h-[14px] w-[2px] rounded bg-foreground"
                      style={{ left: `calc(${Math.min(100, row.targetPercent)}% - 1px)` }}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {advice ? <p className="mt-5 rounded-[8px] bg-yellow-bg px-3.5 py-3 text-[13px] text-yellow-fg">{advice}</p> : null}
          {unclassified.length ? (
            <p className="mt-4 text-[12px] text-muted">
              {unclassified.map((a) => a.name).join(", ")} {unclassified.length === 1 ? "has" : "have"} no asset class and
              {unclassified.length === 1 ? " is" : " are"} counted as Other. Set it on the{" "}
              <Link href="/accounts" className="underline underline-offset-2">
                Accounts
              </Link>{" "}
              page.
            </p>
          ) : null}
        </Panel>

        <Panel className="lg:col-span-6" title="Accounts" subtitle="The last 12 months">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="pb-3 font-normal">Account</th>
                  <th className="pb-3 text-right font-normal">Value</th>
                  <th className="pb-3 text-right font-normal">Put in</th>
                  <th className="pb-3 text-right font-normal">Return</th>
                  <th className="pb-3 text-right font-normal">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {investments.accounts.map((account) => (
                  <tr key={account.accountId}>
                    <td className="py-2.5">
                      {account.name}
                      <span className="block text-[11px] text-faint">
                        {account.lastValuedOn ? `valued ${account.lastValuedOn}` : "never valued"}
                      </span>
                    </td>
                    <td className="num py-2.5 text-right">{formatCents(account.valueCents, 0)}</td>
                    <td className="num py-2.5 text-right">{formatCents(account.contributedCents, 0)}</td>
                    <td className="num py-2.5 text-right">{pct(account.returnPercent)}</td>
                    <td className="num py-2.5 text-right">
                      {account.expenseRatioBps === null ? "—" : `${(account.expenseRatioBps / 100).toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <p className="text-[12px] leading-relaxed text-faint">
        Educational only: no fund, product or provider is recommended. Returns come from the values you enter, so they are
        only as current as your last update.
      </p>

      <Modal
        open={editingTargets}
        title="Target asset mix"
        description="The share of invested money you aim to hold in each class. Shares must add up to 100%."
        onClose={() => setEditingTargets(false)}
      >
        {editingTargets ? (
          <TargetForm current={investments.targets} onDone={() => setEditingTargets(false)} />
        ) : null}
      </Modal>
    </div>
  );
}

function TargetForm({
  current,
  onDone,
}: {
  current: Array<{ assetClass: AssetClass; percent: number }>;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<AssetClass, string>>(
    () =>
      Object.fromEntries(
        ASSET_CLASSES.map(({ value }) => [value, String(current.find((t) => t.assetClass === value)?.percent ?? "")]),
      ) as Record<AssetClass, string>,
  );
  const save = useSetTargetAllocation();
  const toast = useToast();
  const targets = ASSET_CLASSES.map(({ value }) => ({ assetClass: value, percent: Number(values[value] || 0) })).filter(
    (target) => target.percent > 0,
  );
  const total = targets.reduce((sum, target) => sum + target.percent, 0);
  const valid = targets.length === 0 || Math.abs(total - 100) < 0.005;

  function submit(next: typeof targets) {
    save.mutate(next, {
      onSuccess: () => {
        toast.success(next.length ? "Target mix saved." : "Target mix cleared.");
        onDone();
      },
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) submit(targets);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {ASSET_CLASSES.map(({ value, label }) => (
          <div key={value}>
            <label className="label" htmlFor={`target-${value}`}>
              {label}
            </label>
            <div className="relative">
              <input
                id={`target-${value}`}
                className="field num pr-8"
                inputMode="decimal"
                value={values[value]}
                onChange={(event) => setValues({ ...values, [value]: event.target.value.replace(/[^\d.]/g, "") })}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">%</span>
            </div>
          </div>
        ))}
      </div>
      <p className={cn("num text-[13px]", valid ? "text-muted" : "text-yellow-fg")}>Total {total.toFixed(1)}%</p>
      {save.error instanceof Error ? (
        <p role="alert" className="rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {save.error.message}
        </p>
      ) : null}
      <div className="-mx-6 flex justify-between gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="ghost" disabled={save.isPending || !current.length} onClick={() => submit([])}>
          Clear target
        </Button>
        <Button type="submit" disabled={save.isPending || !valid}>
          {save.isPending ? <Spinner /> : null}
          Save target
        </Button>
      </div>
    </form>
  );
}
