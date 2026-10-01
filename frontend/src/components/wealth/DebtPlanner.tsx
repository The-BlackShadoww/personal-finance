"use client";

import { Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AreaChart } from "@/components/charts/AreaChart";
import { Legend } from "@/components/charts/core";
import { Panel } from "@/components/dashboard/primitives";
import { MoneyField } from "@/components/goals/GoalForm";
import { Button, buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { WealthOverview } from "@/lib/api/wealth";
import { comparePayoff, minimumFor, payoffOrder, type Debt, type PayoffResult, type Strategy } from "@/lib/finance/debt";
import { useCreateRecurring } from "@/lib/hooks/useRecurring";
import { cn } from "@/lib/utils/cn";
import { formatCents, formatMoney, parseAmountInput } from "@/lib/utils/money";

const STRATEGIES: Array<{ value: Exclude<Strategy, "minimum">; label: string; hint: string }> = [
  { value: "avalanche", label: "Avalanche", hint: "Highest rate first. Saves the most interest." },
  { value: "snowball", label: "Snowball", hint: "Smallest balance first. Quick wins keep you going." },
];

const SERIES = [
  { key: "avalanche", label: "Avalanche", color: "var(--ds-series-net)" },
  { key: "snowball", label: "Snowball", color: "var(--ds-series-income)" },
  { key: "minimum", label: "Minimums only", color: "var(--ds-series-expense)" },
];

/** The first day of the month `offset` months from now, "YYYY-MM-DD". */
function monthStart(offset: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(offset: number, style: "short" | "long") {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return date.toLocaleString("en-US", style === "short" ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" });
}

const duration = (months: number | null) => {
  if (months === null) return "Never at this pace";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} yr` : null, rest ? `${rest} mo` : null].filter(Boolean).join(" ") || "0 mo";
};

/** Avalanche vs snowball vs minimums for the user's debts, with "apply this plan". */
export function DebtPlanner({ data }: { data: WealthOverview }) {
  const [extra, setExtra] = useState("");
  const [strategy, setStrategy] = useState<Exclude<Strategy, "minimum">>("avalanche");
  const [confirming, setConfirming] = useState(false);

  const debts: Debt[] = useMemo(
    () =>
      data.debts.map((debt) => ({
        id: debt.accountId,
        name: debt.name,
        balanceCents: debt.balanceCents,
        aprBps: debt.aprBps,
        minimumPaymentCents: debt.minimumPaymentCents,
      })),
    [data.debts],
  );
  const parsedExtra = parseAmountInput(extra);
  const extraCents = parsedExtra && Number.isFinite(parsedExtra) && parsedExtra > 0 ? Math.round(parsedExtra * 100) : 0;
  const plans = useMemo(() => comparePayoff(debts, extraCents), [debts, extraCents]);
  const chosen = plans[strategy];

  if (!debts.length) {
    return (
      <Panel title="Debt payoff" subtitle="Credit cards and loans">
        <p className="text-[14px] text-muted">
          No debts recorded — nothing to pay off.{" "}
          <Link href="/accounts" className="text-foreground underline underline-offset-4">
            Add a card or loan
          </Link>{" "}
          with its rate and minimum payment to plan a payoff.
        </p>
      </Panel>
    );
  }

  const names = new Map(debts.map((debt) => [debt.id, debt.name]));
  const warnings = [
    ...plans.minimum.negativeAmortization.map(
      (id) => `${names.get(id)}: the minimum payment does not cover the interest, so the balance grows on minimums alone.`,
    ),
    ...(chosen.assumedMinimums.length
      ? [`No minimum payment entered for ${chosen.assumedMinimums.map((id) => names.get(id)).join(", ")}; 2% of the balance is assumed.`]
      : []),
    ...(debts.some((debt) => debt.aprBps === null) ? ["Debts without an interest rate are treated as 0% — add the rate for a true picture."] : []),
  ];

  return (
    <div className="space-y-3">
      <Panel
        title="Debt payoff"
        subtitle="Pay every minimum, then put everything extra on one debt at a time"
        action={
          <SegmentedControl
            label="Payoff strategy"
            value={strategy}
            onChange={setStrategy}
            options={STRATEGIES.map(({ value, label }) => ({ value, label }))}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <MoneyField id="debt-extra" label="Extra each month" value={extra} onChange={setExtra} optional />
            <p className="text-[12px] leading-relaxed text-muted">
              {STRATEGIES.find((s) => s.value === strategy)?.hint} Minimums total{" "}
              <span className="num text-foreground">
                {formatCents(debts.reduce((sum, debt) => sum + minimumFor(debt), 0), 0)}
              </span>{" "}
              a month; when a debt is cleared its minimum moves to the next one.
            </p>
            {warnings.length ? (
              <ul className="space-y-2">
                {warnings.map((warning) => (
                  <li key={warning} className="flex gap-2 rounded-[8px] bg-yellow-bg px-3 py-2.5 text-[12px] text-yellow-fg">
                    <Warning size={13} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(["avalanche", "snowball", "minimum"] as const).map((key) => (
              <StrategyCard
                key={key}
                label={key === "minimum" ? "Minimums only" : STRATEGIES.find((s) => s.value === key)!.label}
                result={plans[key]}
                saved={key === "minimum" ? null : plans[key].interestSavedCents}
                active={key === strategy}
              />
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel
          className="lg:col-span-7"
          title="What you owe over time"
          action={<Legend series={SERIES} />}
        >
          <BalanceChart plans={plans} />
        </Panel>
        <Panel
          className="lg:col-span-5"
          title="Payoff order"
          subtitle={`${STRATEGIES.find((s) => s.value === strategy)?.label}, with your extra amount`}
        >
          <ol className="divide-y divide-line">
            {payoffOrder(debts, strategy).map((debt, index) => (
              <li key={debt.id} className="flex items-center gap-3 py-3 text-[13px] first:pt-0">
                <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{debt.name}</p>
                  <p className="num text-[12px] text-muted">
                    {formatCents(debt.balanceCents, 0)} · {debt.aprBps === null ? "rate not set" : `${(debt.aprBps / 100).toFixed(1)}% APR`}
                  </p>
                </div>
                <p className="num shrink-0 text-right text-[12px] text-muted">
                  {chosen.payoffMonth[debt.id] ? (
                    <>
                      <span className="text-foreground">{monthLabel(chosen.payoffMonth[debt.id]!, "short")}</span>
                      <span className="block">{formatCents(chosen.firstMonthPayments[debt.id] ?? 0, 0)}/mo now</span>
                    </>
                  ) : (
                    "Not paid off"
                  )}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-5 border-t border-line pt-5">
            <Button size="sm" onClick={() => setConfirming(true)} disabled={!data.defaultAccount || chosen.months === null}>
              Apply this plan
            </Button>
            <p className="mt-2 text-[12px] text-muted">
              Sets up a monthly payment to each debt from {data.defaultAccount?.name ?? "your default account"}, waiting for
              your confirmation each month.
            </p>
          </div>
        </Panel>
      </div>

      <ApplyPlanModal
        open={confirming}
        onClose={() => setConfirming(false)}
        debts={debts}
        plan={chosen}
        fromAccount={data.defaultAccount}
      />
    </div>
  );
}

function StrategyCard({
  label,
  result,
  saved,
  active,
}: {
  label: string;
  result: PayoffResult;
  saved: number | null;
  active: boolean;
}) {
  return (
    <article className={cn("rounded-[10px] border p-4", active ? "border-line-strong bg-surface-2" : "border-line")}>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num mt-2 text-[20px] leading-none tracking-[-0.02em]">{duration(result.months)}</p>
      <p className="num mt-1 text-[12px] text-muted">
        {result.months === null ? "Balance keeps growing" : `Debt-free ${monthLabel(result.months, "long")}`}
      </p>
      <dl className="mt-4 space-y-1 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Interest</dt>
          <dd className="num">{result.months === null ? "—" : formatCents(result.totalInterestCents, 0)}</dd>
        </div>
        {saved !== null ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Saved vs minimums</dt>
            <dd className="num text-green-fg">{saved > 0 ? formatCents(saved, 0) : "—"}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function BalanceChart({ plans }: { plans: ReturnType<typeof comparePayoff> }) {
  const points = useMemo(() => {
    const finite = [plans.avalanche, plans.snowball, plans.minimum].map((p) => p.balances.length - 1);
    const horizon = Math.min(360, Math.max(12, ...finite));
    // At most ~60 points so the chart stays readable.
    const step = Math.max(1, Math.ceil(horizon / 60));
    // Past the end of a schedule the last (zero) balance repeats.
    const at = (result: PayoffResult, month: number) => result.balances[Math.min(month, result.balances.length - 1)] / 100;
    const rows = [];
    for (let month = 0; month <= horizon; month += step) {
      rows.push({
        label: monthLabel(month, "short"),
        title: monthLabel(month, "long"),
        values: {
          avalanche: at(plans.avalanche, month),
          snowball: at(plans.snowball, month),
          minimum: at(plans.minimum, month),
        },
      });
    }
    return rows;
  }, [plans]);

  return (
    <AreaChart
      data={points}
      series={SERIES}
      fill={false}
      height={280}
      formatValue={(value) => formatMoney(value, 0)}
      ariaLabel="Total owed each month under each payoff strategy"
    />
  );
}

function ApplyPlanModal({
  open,
  onClose,
  debts,
  plan,
  fromAccount,
}: {
  open: boolean;
  onClose: () => void;
  debts: Debt[];
  plan: PayoffResult;
  fromAccount: { id: string; name: string } | null;
}) {
  const createRule = useCreateRecurring();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payments = debts
    .map((debt) => ({ debt, amountCents: plan.firstMonthPayments[debt.id] ?? 0, payoffMonth: plan.payoffMonth[debt.id] }))
    .filter((payment) => payment.amountCents > 0);

  async function apply() {
    if (!fromAccount) return;
    setSaving(true);
    setError(null);
    try {
      // One rule per debt, ending the month it is paid off.
      for (const { debt, amountCents, payoffMonth } of payments) {
        await createRule.mutateAsync({
          name: `Pay ${debt.name}`,
          type: "transfer",
          amount: amountCents / 100,
          accountId: fromAccount.id,
          counterAccountId: debt.id,
          frequency: "monthly",
          anchorDate: monthStart(1),
          endDate: payoffMonth ? monthStart(payoffMonth) : null,
          autoPost: false,
        });
      }
      toast.success(`${payments.length} monthly ${payments.length === 1 ? "payment" : "payments"} scheduled.`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule the payments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Apply this payoff plan?"
      description={`Monthly transfers from ${fromAccount?.name ?? "your default account"}, starting ${monthLabel(1, "long")}. Each waits under Due for you to confirm.`}
      onClose={() => !saving && onClose()}
    >
      <ul className="divide-y divide-line text-[13px]">
        {payments.map(({ debt, amountCents, payoffMonth }) => (
          <li key={debt.id} className="flex justify-between gap-4 py-2.5">
            <span>
              Pay {debt.name}
              <span className="block text-[12px] text-muted">
                {payoffMonth ? `until ${monthLabel(payoffMonth, "long")}` : "no end date"}
              </span>
            </span>
            <span className="num">{formatCents(amountCents)}/mo</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        These are this month&apos;s amounts. When a debt is cleared, raise the next debt&apos;s payment by the amount that was
        freed up — that is what makes the plan work.
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded-[8px] bg-red-bg px-3.5 py-3 text-[13px] text-red-fg">
          {error}
        </p>
      ) : null}
      <div className="-mx-6 mt-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={apply} disabled={saving || !payments.length}>
          {saving ? <Spinner /> : null}
          Schedule payments
        </Button>
      </div>
      <Link href="/transactions?tab=recurring" className={buttonClass({ variant: "link", className: "mt-3 text-[12px]" })}>
        See recurring entries
      </Link>
    </Modal>
  );
}
