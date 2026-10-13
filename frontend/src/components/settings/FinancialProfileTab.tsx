"use client";

import { Lightbulb } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { FinancialProfile, IncomeStability } from "@/lib/api/financialProfile";
import { useFinancialProfile, useUpdateFinancialProfile } from "@/lib/hooks/useFinancialProfile";
import { ChoiceGroup, Notice, SectionTitle } from "./ui";
import { Select } from "@/components/ui/Select";

type Answers = {
  incomeStability: IncomeStability | null;
  dependents: number | null;
  hasHealthInsurance: boolean | null;
  hasLifeInsurance: boolean | null;
  employerMatchPercent: number | null;
  retirementAgeTarget: number | null;
  safeWithdrawalPercent: number;
  expectedRealReturnPercent: number;
  /** Major units as typed; empty = off. */
  coolingOffThreshold: string;
  coolingOffHours: number;
};

function toAnswers(profile: FinancialProfile): Answers {
  return {
    incomeStability: profile.incomeStability,
    dependents: profile.dependents,
    hasHealthInsurance: profile.hasHealthInsurance,
    hasLifeInsurance: profile.hasLifeInsurance,
    employerMatchPercent: profile.employerMatchPercent,
    retirementAgeTarget: profile.retirementAgeTarget,
    safeWithdrawalPercent: profile.safeWithdrawalBps / 100,
    expectedRealReturnPercent: profile.expectedRealReturnBps / 100,
    coolingOffThreshold: profile.coolingOffThresholdCents === null ? "" : String(profile.coolingOffThresholdCents / 100),
    coolingOffHours: profile.coolingOffHours,
  };
}

const WITHDRAWAL_RATES = [3, 3.25, 3.5, 3.75, 4, 4.5, 5];
const REAL_RETURNS = [2, 3, 4, 5, 6, 7, 8];
const COOLING_HOURS = [
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
  { value: 72, label: "3 days" },
  { value: 168, label: "1 week" },
  { value: 336, label: "2 weeks" },
  { value: 720, label: "30 days" },
];

/** Keeps a value saved outside the preset list selectable. */
function withCurrent(options: number[], current: number) {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

const YES_NO = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

/** Empty input clears the answer; otherwise clamps to [min, max]. */
function parseWhole(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const value = Math.round(Number(raw));
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
}

export function FinancialProfileTab() {
  const { data: profile, isLoading } = useFinancialProfile();
  const update = useUpdateFinancialProfile();
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setAnswers(toAnswers(profile));
  }, [profile]);

  if (isLoading || !answers || !profile) {
    return (
      <div className="max-w-xl space-y-3">
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </div>
    );
  }

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setSaved(false);
    setAnswers((current) => (current ? { ...current, [key]: value } : current));
  };

  const hasDependents = (answers.dependents ?? 0) > 0;
  const required = [
    answers.incomeStability !== null,
    answers.dependents !== null,
    answers.hasHealthInsurance !== null,
    answers.employerMatchPercent !== null,
    ...(hasDependents ? [answers.hasLifeInsurance !== null] : []),
  ];
  const answered = required.filter(Boolean).length;
  const isDirty = JSON.stringify(answers) !== JSON.stringify(toAnswers(profile));

  const assessment = profile.incomeAssessment;
  const suggestion =
    assessment.stability && assessment.coefficientOfVariation !== null
      ? {
          stability: assessment.stability,
          text: `Your income over the last ${assessment.monthsConsidered} months varied by about ${Math.round(
            assessment.coefficientOfVariation * 100,
          )}%, which looks ${assessment.stability === "variable" ? "irregular" : "steady"}.`,
        }
      : null;

  const parsedThreshold = Number(answers.coolingOffThreshold.replace(/,/g, ""));
  const coolingOffThreshold =
    answers.coolingOffThreshold.trim() === "" || !Number.isFinite(parsedThreshold) || parsedThreshold <= 0
      ? null
      : Math.round(parsedThreshold * 100) / 100;

  async function save() {
    if (!answers) return;
    setSaved(false);
    await update.mutateAsync({
      incomeStability: answers.incomeStability,
      dependents: answers.dependents,
      hasHealthInsurance: answers.hasHealthInsurance,
      // Life cover is only asked about when someone depends on this income.
      hasLifeInsurance: hasDependents ? answers.hasLifeInsurance : null,
      employerMatchPercent: answers.employerMatchPercent,
      retirementAgeTarget: answers.retirementAgeTarget,
      safeWithdrawalBps: Math.round(answers.safeWithdrawalPercent * 100),
      expectedRealReturnBps: Math.round(answers.expectedRealReturnPercent * 100),
      coolingOffThreshold: coolingOffThreshold,
      coolingOffHours: answers.coolingOffHours,
    });
    setSaved(true);
  }

  return (
    <div className="max-w-xl space-y-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-muted">
          These answers set your emergency-fund target, insurance checks and the order of your next steps.
        </p>
        <span className="num shrink-0 text-[13px] text-muted">
          {answered} of {required.length} answered
        </span>
      </div>

      <Question
        title="How steady is your income?"
        why="Irregular income needs a bigger cushion: 6–12 months of essential costs instead of 3–6."
      >
        <ChoiceGroup
          label="Income stability"
          value={answers.incomeStability}
          onChange={(value) => set("incomeStability", value)}
          options={[
            { value: "stable", label: "Steady — mostly salary" },
            { value: "variable", label: "Irregular — freelance, commission, seasonal" },
          ]}
        />
        {suggestion ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-[8px] bg-blue-bg px-3.5 py-3 text-[13px] text-blue-fg">
            <Lightbulb size={15} weight="fill" className="mt-px shrink-0" />
            <p>
              {suggestion.text}
              {answers.incomeStability !== suggestion.stability ? (
                <button
                  type="button"
                  className="ml-1.5 underline underline-offset-2"
                  onClick={() => set("incomeStability", suggestion.stability)}
                >
                  Use this
                </button>
              ) : null}
            </p>
          </div>
        ) : null}
      </Question>

      <Question
        title="How many people depend on your income?"
        why="Children, a partner without income, or parents you support. If anyone relies on you, life cover matters."
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          aria-label="Number of dependents"
          className="field w-32"
          value={answers.dependents ?? ""}
          onChange={(event) => set("dependents", parseWhole(event.target.value, 0, 20))}
        />
      </Question>

      <Question title="Do you have health insurance?" why="One hospital bill can undo years of saving.">
        <ChoiceGroup
          label="Health insurance"
          value={answers.hasHealthInsurance}
          onChange={(value) => set("hasHealthInsurance", value)}
          options={YES_NO}
        />
      </Question>

      {hasDependents ? (
        <Question
          title="Do you have life insurance?"
          why="Term life cover replaces your income for the people who rely on it."
        >
          <ChoiceGroup
            label="Life insurance"
            value={answers.hasLifeInsurance}
            onChange={(value) => set("hasLifeInsurance", value)}
            options={YES_NO}
          />
        </Question>
      ) : null}

      <Question
        title="Does your employer match retirement contributions?"
        why="A match is an instant 50–100% return on what you put in. Capture it in full before investing elsewhere."
      >
        <ChoiceGroup
          label="Employer match"
          value={answers.employerMatchPercent === null ? null : answers.employerMatchPercent > 0}
          onChange={(offered) => set("employerMatchPercent", offered ? Math.max(answers.employerMatchPercent ?? 0, 1) : 0)}
          options={[
            { value: false, label: "Not offered" },
            { value: true, label: "Yes" },
          ]}
        />
        {answers.employerMatchPercent !== null && answers.employerMatchPercent > 0 ? (
          <label className="mt-3 flex items-center gap-3 text-[13px] text-muted">
            Matched up to
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              className="field w-24"
              value={answers.employerMatchPercent}
              onChange={(event) => set("employerMatchPercent", parseWhole(event.target.value, 1, 100) ?? 1)}
            />
            % of salary
          </label>
        ) : null}
      </Question>

      <details className="group rounded-[10px] border border-line px-5 py-4">
        <summary className="cursor-pointer text-[14px] text-foreground">Retirement assumptions</summary>
        <div className="mt-5 space-y-6">
          <p className="text-[13px] text-muted">
            Used for financial-independence projections. The defaults are common starting points, not predictions.
          </p>
          <label className="block">
            <span className="label">Target retirement age <span className="text-faint">optional</span></span>
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={90}
              className="field w-32"
              value={answers.retirementAgeTarget ?? ""}
              onChange={(event) => set("retirementAgeTarget", parseWhole(event.target.value, 30, 90))}
            />
          </label>
          <label className="block">
            <span className="label">Safe withdrawal rate (%)</span>
            <Select
              className="field w-32"
              value={answers.safeWithdrawalPercent}
              onChange={(event) => set("safeWithdrawalPercent", Number(event.target.value))}
            >
              {withCurrent(WITHDRAWAL_RATES, answers.safeWithdrawalPercent).map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </Select>
            <span className="mt-1.5 block text-[12px] text-muted">
              4% is the classic rule of thumb; 3–3.5% is more cautious for retiring early.
            </span>
          </label>
          <label className="block">
            <span className="label">Expected return after inflation (%)</span>
            <Select
              className="field w-32"
              value={answers.expectedRealReturnPercent}
              onChange={(event) => set("expectedRealReturnPercent", Number(event.target.value))}
            >
              {withCurrent(REAL_RETURNS, answers.expectedRealReturnPercent).map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </Select>
            <span className="mt-1.5 block text-[12px] text-muted">
              Real (inflation-adjusted) returns keep projections in today&rsquo;s money.
            </span>
          </label>
        </div>
      </details>

      <Question
        title="Cooling-off rule"
        why="Waiting before a non-essential purchase lets the urge pass. Skipped buys add up."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">
              For wants costing at least <span className="text-faint">empty = off</span>
            </span>
            <input
              className="field num"
              inputMode="decimal"
              value={answers.coolingOffThreshold}
              onChange={(event) => set("coolingOffThreshold", event.target.value.replace(/[^\d.,]/g, ""))}
            />
          </label>
          <label className="block">
            <span className="label">Wait</span>
            <Select
              className="field"
              value={answers.coolingOffHours}
              onChange={(event) => set("coolingOffHours", Number(event.target.value))}
            >
              {COOLING_HOURS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {COOLING_HOURS.some((option) => option.value === answers.coolingOffHours) ? null : (
                <option value={answers.coolingOffHours}>{answers.coolingOffHours} hours</option>
              )}
            </Select>
          </label>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {coolingOffThreshold === null
            ? "Off. You can still add things to the cooling-off list on the Goals page."
            : "When you record a non-essential expense at or above this, you'll be offered the cooling-off list instead."}
        </p>
      </Question>

      <div className="space-y-4">
        <Notice show={Boolean(update.error)} tone="error">
          {(update.error as Error)?.message ?? "Failed to save your answers"}
        </Notice>
        <Notice show={saved && !isDirty} tone="success">
          Saved. Your targets and suggestions will use these answers.
        </Notice>
        <div className="flex items-center gap-4">
          <Button type="button" onClick={save} disabled={update.isPending || !isDirty}>
            {update.isPending ? <Spinner /> : null}
            {update.isPending ? "Saving…" : "Save answers"}
          </Button>
          {!isDirty && !saved ? <span className="text-[13px] text-faint">No changes to save</span> : null}
        </div>
        <p className="text-[12px] text-faint">
          Educational guidance based on widely used personal-finance rules, not individual financial advice.
        </p>
      </div>
    </div>
  );
}

function Question({ title, why, children }: { title: string; why: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle title={title} description={why} />
      <div className="-mt-2">{children}</div>
    </section>
  );
}
