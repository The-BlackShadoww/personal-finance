"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Panel } from "@/components/dashboard/primitives";
import { Stat } from "@/components/wealth/Stat";
import { MoneyField } from "@/components/goals/GoalForm";
import type { WealthOverview } from "@/lib/api/wealth";
import {
  SENSITIVITY_RETURNS,
  coastFiNumber,
  fiNumber,
  monthsToTarget,
  sensitivityTable,
} from "@/lib/finance/fi";
import { cn } from "@/lib/utils/cn";
import { formatCents, parseAmountInput } from "@/lib/utils/money";

const centsInput = (cents: number | null) => (cents === null ? "" : String(Math.round(cents / 100)));
const toCents = (raw: string) => {
  const parsed = parseAmountInput(raw);
  return parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
};

/** Financial independence: the number, the date, coast FI and what moves them. */
export function FiCalculator({ data }: { data: WealthOverview }) {
  const { fi, assumptions } = data;
  const [annualExpense, setAnnualExpense] = useState(centsInput(fi.annualExpenseCents));
  const [invested, setInvested] = useState(centsInput(fi.investedCents));
  const [monthly, setMonthly] = useState(centsInput(fi.monthlyInvestingCents));
  const [swr, setSwr] = useState(assumptions.safeWithdrawalBps / 100);
  const [realReturn, setRealReturn] = useState(assumptions.expectedRealReturnBps / 100);
  const [age, setAge] = useState(30);
  const [retireAge, setRetireAge] = useState(assumptions.retirementAgeTarget ?? 60);

  const result = useMemo(() => {
    const annualCents = toCents(annualExpense);
    const investedCents = toCents(invested);
    const monthlyCents = toCents(monthly);
    const target = fiNumber(annualCents, swr / 100);
    const months = annualCents > 0 ? monthsToTarget(investedCents, monthlyCents, realReturn / 100, target) : null;
    const yearsToRetirement = Math.max(0, retireAge - age);
    const coast = coastFiNumber(target, realReturn / 100, yearsToRetirement);
    return {
      annualCents,
      investedCents,
      target,
      months,
      progress: target > 0 && Number.isFinite(target) ? Math.min(100, (investedCents / target) * 100) : 0,
      coast,
      yearsToRetirement,
    };
  }, [age, annualExpense, invested, monthly, realReturn, retireAge, swr]);

  const table = useMemo(
    () => (fi.monthlyIncomeCents ? sensitivityTable(fi.monthlyIncomeCents, result.investedCents, swr / 100) : null),
    [fi.monthlyIncomeCents, result.investedCents, swr],
  );
  const currentRate =
    fi.monthlyIncomeCents && fi.monthlyExpenseCents !== null
      ? (fi.monthlyIncomeCents - fi.monthlyExpenseCents) / fi.monthlyIncomeCents
      : null;

  const years = result.months === null ? null : result.months / 12;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-5" title="Your numbers" subtitle="Filled in from your records; change any to explore">
          <div className="space-y-4">
            <MoneyField id="fi-expense" label="Yearly spending" value={annualExpense} onChange={setAnnualExpense} />
            <MoneyField id="fi-invested" label="Invested today" value={invested} onChange={setInvested} />
            <MoneyField id="fi-monthly" label="Invested each month" value={monthly} onChange={setMonthly} />
            <Slider id="fi-swr" label="Safe withdrawal rate" value={swr} min={2.5} max={5} step={0.1} unit="%" onChange={setSwr}
              hint="4% is the classic rule; 3–3.5% for retiring early." />
            <Slider id="fi-return" label="Return after inflation" value={realReturn} min={0} max={10} step={0.5} unit="%" onChange={setRealReturn}
              hint="Real returns keep every result in today's money." />
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="fi-age" label="Your age" value={age} onChange={setAge} />
              <NumberField id="fi-retire" label="Retire at" value={retireAge} onChange={setRetireAge} />
            </div>
          </div>
        </Panel>

        <div className="space-y-3 lg:col-span-7">
          <section className="card-muted p-7 md:p-8">
            <p className="eyebrow">Financial independence number</p>
            <p className="num mt-4 text-[44px] font-[360] leading-none tracking-[-0.04em] md:text-[56px]">
              {Number.isFinite(result.target) && result.annualCents > 0 ? formatCents(result.target, 0) : "—"}
            </p>
            <p className="mt-3 text-[13px] text-muted">
              Invested money that could pay your yearly spending at a {swr.toFixed(1)}% withdrawal rate.
            </p>
            <div className="mt-6 h-[6px] overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-green-fg" style={{ width: `${result.progress}%` }} />
            </div>
            <p className="num mt-2 text-[12px] text-muted">{result.progress.toFixed(1)}% of the way there</p>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Years to FI"
              value={result.annualCents === 0 ? "—" : years === null ? "100+" : years.toFixed(1)}
              note={years === null ? "Invest something each month to get there" : `around age ${Math.round(age + years)}`}
            />
            <Stat
              label="Coast FI"
              value={result.annualCents > 0 ? formatCents(result.coast, 0) : "—"}
              note={
                result.investedCents >= result.coast && result.annualCents > 0
                  ? `Reached: growth alone gets you there by ${retireAge}`
                  : `Invested today that grows to it by ${retireAge}`
              }
            />
            <Stat
              label="Passive income"
              value={fi.passiveCoverage === null ? "—" : `${fi.passiveCoverage.toFixed(1)}%`}
              note="of spending covered by passive and investment income"
            />
          </div>
        </div>
      </div>

      {table ? (
        <Panel
          title="What moves the date"
          subtitle="Years to financial independence by savings rate and return, assuming you spend what you don't save"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-3 font-normal">Savings rate</th>
                  {SENSITIVITY_RETURNS.map((r) => (
                    <th key={r} className="num pb-3 text-right font-normal">
                      {(r * 100).toFixed(0)}% return
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.map((row) => {
                  const mine = currentRate !== null && Math.abs(currentRate - row.savingsRate) < 0.05;
                  return (
                    <tr key={row.savingsRate} className={cn(mine && "bg-surface-2")}>
                      <td className="num py-2.5">
                        {(row.savingsRate * 100).toFixed(0)}%{mine ? <span className="ml-2 text-[11px] text-muted">≈ you</span> : null}
                      </td>
                      {row.years.map((value, index) => (
                        <td key={index} className="num py-2.5 text-right">
                          {value === null ? "—" : `${value.toFixed(1)} yr`}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12px] text-muted">
            Read down a column, then across a row: saving more shortens the wait far more than a higher return does.
          </p>
        </Panel>
      ) : null}

      <p className="text-[12px] leading-relaxed text-faint">
        Projections rest on the assumptions above and are not guarantees. Returns vary year to year.
      </p>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <span className="num text-[13px]">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
        style={{ "--range-fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
      />
      {hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={16}
        max={100}
        className="field num"
        value={value}
        onChange={(event) => onChange(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
      />
    </div>
  );
}
