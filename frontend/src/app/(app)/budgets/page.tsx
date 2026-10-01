"use client";

import { CheckCircle, Copy, Lightning, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CategoryBudgetRow } from "@/components/budgets/CategoryBudgetRow";
import { MoveMoneyForm } from "@/components/budgets/MoveMoneyForm";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { PeriodStepper } from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { BudgetItem, BudgetMethod, PlanCategory, PlanGroup, SpendingPlan, TargetCheck } from "@/lib/api/budgets";
import { useCopyPreviousBudgets, usePlan, useSaveBudgets, useUpdatePlan } from "@/lib/hooks/useBudgets";
import { cn } from "@/lib/utils/cn";
import { currencySymbol, formatCents, parseAmountInput } from "@/lib/utils/money";

const METHODS: Array<{ value: BudgetMethod; label: string; description: string }> = [
  {
    value: "fifty_thirty_twenty",
    label: "50/30/20",
    description: "Needs up to 50% of income, wants up to 30%, at least 20% to savings and extra debt payments.",
  },
  {
    value: "seventy_twenty_ten",
    label: "70/20/10",
    description: "Living costs up to 70%, at least 20% saved, 10% to extra debt payments or giving.",
  },
  {
    value: "zero_based",
    label: "Zero-based",
    description: "Give every unit of income a job until nothing is left to assign.",
  },
  {
    value: "category_caps",
    label: "Caps only",
    description: "Limits per category, without income targets.",
  },
];

// Outgoing amounts show as negatives; 0 stays 0 rather than "-0".
const negate = (cents: number) => (cents === 0 ? 0 : -cents);

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export default function PlanPage() {
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { data: plan, isLoading, isFetching } = usePlan(period.year, period.month);
  const updatePlan = useUpdatePlan();
  const saveBudgets = useSaveBudgets();
  const copyPrevious = useCopyPreviousBudgets();
  const toast = useToast();
  const [moving, setMoving] = useState<PlanCategory | null>(null);

  const monthLabel = new Date(period.year, period.month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const step = (delta: number) =>
    setPeriod(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });

  function save(items: BudgetItem[], onDone?: () => void) {
    saveBudgets.mutate(
      { ...period, items },
      { onSuccess: () => onDone?.(), onError: (error) => toast.error(errorMessage(error)) },
    );
  }

  function startFromAverages(current: SpendingPlan) {
    const items = [...current.needs.categories, ...current.wants.categories]
      .filter((category) => category.suggestedCents > 0)
      .map((category) => ({ categoryId: category.categoryId, amount: category.suggestedCents / 100, rollover: false }));
    if (!items.length) {
      toast.error("No spending in the last 3 months to learn from yet.");
      return;
    }
    save(items, () => toast.success(`Budgets set for ${items.length} categories from your 3-month history.`));
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Plan"
        title="Plan the month before it happens."
        aside="Pay yourself first, cover your needs, then enjoy the rest — guilt-free."
        actions={
          <PeriodStepper
            label={monthLabel}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            previousLabel="Previous month"
            nextLabel="Next month"
          />
        }
      />

      {isLoading || !plan ? (
        <div className="space-y-3">
          <div className="skeleton h-48" />
          <div className="skeleton h-72" />
        </div>
      ) : (
        <div className={cn("space-y-10 transition-opacity", isFetching && "opacity-80")}>
          <div className="grid gap-3 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <PlanSettings
                plan={plan}
                saving={updatePlan.isPending}
                onChange={(payload) =>
                  updatePlan.mutate({ ...period, ...payload }, { onError: (error) => toast.error(errorMessage(error)) })
                }
              />
            </Reveal>
            <Reveal className="lg:col-span-7" delay={0.04}>
              <Waterfall plan={plan} />
            </Reveal>
          </div>

          {!plan.hasBudgets ? (
            <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px]">No budgets for {monthLabel} yet.</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  Start from what you actually spend, then trim. Or type amounts into the categories below.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {plan.previousHasBudgets ? (
                  <Button
                    variant="secondary"
                    disabled={copyPrevious.isPending}
                    onClick={() =>
                      copyPrevious.mutate(period, {
                        onSuccess: (result) => toast.success(`Copied ${result.copied} budgets from last month.`),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                  >
                    {copyPrevious.isPending ? <Spinner /> : <Copy size={14} weight="bold" />} Copy last month
                  </Button>
                ) : null}
                <Button onClick={() => startFromAverages(plan)} disabled={saveBudgets.isPending}>
                  <Lightning size={14} weight="bold" /> Start from my 3-month average
                </Button>
              </div>
            </section>
          ) : null}

          <PayFirst plan={plan} />

          <BudgetGroup
            title="② Needs"
            subtitle="Essential spending: hard to cut. Mark categories as needs in Settings → Categories."
            group={plan.needs}
            saving={saveBudgets.isPending}
            onSave={(item) => save([item])}
            onMoveMoney={setMoving}
          />
          <BudgetGroup
            title="③ Wants"
            subtitle="Everything else. Spend on what you value, cut what you don't."
            group={plan.wants}
            saving={saveBudgets.isPending}
            onSave={(item) => save([item])}
            onMoveMoney={setMoving}
          />
        </div>
      )}

      <Modal open={moving !== null} title={moving ? `Cover ${moving.name}` : ""} size="sm" onClose={() => setMoving(null)}>
        {moving && plan ? (
          <MoveMoneyForm
            key={moving.categoryId}
            target={moving}
            categories={[...plan.needs.categories, ...plan.wants.categories]}
            saving={saveBudgets.isPending}
            onSubmit={(items) =>
              save(items, () => {
                toast.success(`Moved budget to ${moving.name}.`);
                setMoving(null);
              })
            }
            onCancel={() => setMoving(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function PlanSettings({
  plan,
  saving,
  onChange,
}: {
  plan: SpendingPlan;
  saving: boolean;
  onChange: (payload: { method?: BudgetMethod; expectedIncome?: number | null }) => void;
}) {
  const [income, setIncome] = useState(String(plan.plan.expectedIncomeCents / 100));
  useEffect(() => setIncome(String(plan.plan.expectedIncomeCents / 100)), [plan.plan.expectedIncomeCents]);
  const method = METHODS.find((item) => item.value === plan.plan.method)!;

  function commitIncome() {
    const parsed = parseAmountInput(income);
    if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
      setIncome(String(plan.plan.expectedIncomeCents / 100));
      return;
    }
    if (Math.round(parsed * 100) !== plan.plan.expectedIncomeCents) onChange({ expectedIncome: parsed });
  }

  return (
    <section className="card h-full space-y-6 p-6 md:p-7">
      <div>
        <label className="label" htmlFor="expected-income">Expected income this month</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">
            {currencySymbol()}
          </span>
          <input
            id="expected-income"
            inputMode="decimal"
            className="field num pl-8 text-[18px]"
            value={income}
            disabled={saving}
            onChange={(event) => setIncome(event.target.value)}
            onBlur={commitIncome}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted">
          <span className="num">{formatCents(plan.income.actualCents)}</span> received so far.
          {plan.plan.suggestedIncomeCents !== null ? (
            plan.plan.expectedIncomeSetCents === null ? (
              <> Suggested from your last 3 months.</>
            ) : plan.plan.suggestedIncomeCents !== plan.plan.expectedIncomeSetCents ? (
              <>
                {" "}
                Your 3-month average is <span className="num">{formatCents(plan.plan.suggestedIncomeCents)}</span>.{" "}
                <button type="button" className="underline underline-offset-2" onClick={() => onChange({ expectedIncome: null })}>
                  Use it
                </button>
              </>
            ) : null
          ) : null}
        </p>
      </div>

      <div>
        <span className="label">Method</span>
        <SegmentedControl
          label="Budgeting method"
          size="sm"
          value={plan.plan.method}
          onChange={(value) => onChange({ method: value })}
          options={METHODS.map((item) => ({ value: item.value, label: item.label }))}
        />
        <p className="mt-2 text-[12px] text-muted">{method.description}</p>
      </div>
    </section>
  );
}

const BUCKET_LABEL: Record<TargetCheck["bucket"], string> = {
  payFirst: "saving",
  needs: "needs",
  wants: "wants",
  living: "living costs",
};

function Waterfall({ plan }: { plan: SpendingPlan }) {
  const income = plan.plan.expectedIncomeCents;
  const pct = (cents: number) => (income > 0 ? `${Math.round((cents / income) * 100)}%` : "—");
  const check = (bucket: TargetCheck["bucket"]) => plan.evaluation.checks.find((item) => item.bucket === bucket);
  const living = check("living");
  const left = plan.evaluation.leftToAssignCents;

  return (
    <section className="card h-full overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-line px-6 py-3 text-[12px] text-muted md:px-7">
        <span>Planned in this order</span>
        <span className="w-28 text-right">Plan</span>
        <span className="w-28 text-right">So far</span>
      </div>
      <WaterfallRow label="Expected income" planned={income} actual={plan.income.actualCents} strong />
      <WaterfallRow
        label="① Pay yourself first"
        hint="Goals, saving, investing, extra debt"
        planned={negate(plan.payFirst.plannedCents)}
        actual={negate(plan.payFirst.actualCents)}
        share={pct(plan.payFirst.plannedCents)}
        check={check("payFirst")}
      />
      <WaterfallRow
        label="② Needs"
        planned={negate(plan.needs.plannedCents)}
        actual={negate(plan.needs.spentCents)}
        share={pct(plan.needs.plannedCents)}
        check={check("needs")}
      />
      <WaterfallRow
        label="③ Wants"
        planned={negate(plan.wants.plannedCents)}
        actual={negate(plan.wants.spentCents)}
        share={pct(plan.wants.plannedCents)}
        check={check("wants")}
      />
      {living ? (
        <p className="border-t border-line px-6 py-3 text-[12px] text-muted md:px-7">
          <TargetNote check={living} /> Needs and wants together: {pct(living.plannedCents)} planned.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4 border-t border-line bg-surface-2/50 px-6 py-4 md:px-7">
        <span className="flex items-center gap-2 text-[14px]">
          {left === 0 ? (
            <CheckCircle size={16} weight="fill" className="text-green-fg" />
          ) : left < 0 ? (
            <WarningCircle size={16} weight="fill" className="text-red-fg" />
          ) : null}
          {left < 0 ? "Planned more than you expect to earn" : "Left to assign"}
        </span>
        <span className={cn("num text-[18px]", left < 0 && "text-red-fg")}>{formatCents(left)}</span>
      </div>
      {plan.plan.method === "zero_based" && left > 0 ? (
        <p className="px-6 pb-4 text-[12px] text-muted md:px-7">
          Zero-based: give the rest a job — a goal, a need, or a want.
        </p>
      ) : null}
    </section>
  );
}

function WaterfallRow({
  label,
  hint,
  planned,
  actual,
  share,
  check,
  strong,
}: {
  label: string;
  hint?: string;
  planned: number;
  actual: number;
  share?: string;
  check?: TargetCheck;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-line px-6 py-3.5 last:border-b-0 md:px-7">
      <div className="min-w-0">
        <p className={cn("text-[14px]", strong && "text-foreground")}>
          {label} {share ? <span className="num text-[12px] text-muted">{share}</span> : null}
        </p>
        {check ? (
          <p className="text-[12px] text-muted">
            <TargetNote check={check} />
          </p>
        ) : hint ? (
          <p className="text-[12px] text-muted">{hint}</p>
        ) : null}
      </div>
      <span className={cn("num w-28 text-right", strong ? "text-[16px]" : "text-[14px]")}>{formatCents(planned)}</span>
      <span className="num w-28 text-right text-[14px] text-muted">{formatCents(actual)}</span>
    </div>
  );
}

function TargetNote({ check }: { check: TargetCheck }) {
  const ok = check.plannedOk && check.actualOk;
  return (
    <span className={ok ? undefined : "text-yellow-fg"}>
      Target {check.kind === "min" ? "at least" : "at most"} {check.percent}% ({formatCents(check.targetCents, 0)})
      {!check.plannedOk
        ? check.kind === "min"
          ? " — plan more for saving."
          : ` — the plan is over on ${BUCKET_LABEL[check.bucket]}.`
        : !check.actualOk
          ? ` — spending on ${BUCKET_LABEL[check.bucket]} has passed it.`
          : ""}
    </span>
  );
}

function PayFirst({ plan }: { plan: SpendingPlan }) {
  const { payFirst } = plan;
  return (
    <section className="card overflow-hidden">
      <GroupHeader
        title="① Pay yourself first"
        subtitle="Set aside before you spend. Planned from how each goal is funded."
        right={<Link href="/goals" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">Manage goals</Link>}
      />
      <ul className="divide-y divide-line">
        {payFirst.goals.map((goal) => (
          <li key={goal.goalId} className="flex items-center gap-3 px-6 py-3.5 md:px-7">
            <span style={{ color: goal.color }}>
              <CategoryIcon name={goal.icon} size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{goal.name}</span>
            <span className="num w-28 text-right text-[13px] text-muted">
              {goal.fundingRule === "manual" ? "by hand" : formatCents(goal.plannedCents)}
            </span>
            <span className="num w-28 text-right text-[13px]">{formatCents(goal.actualCents)}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 px-6 py-3.5 md:px-7">
          <span className="min-w-0 flex-1 text-[14px] text-muted">Other saving, investing and debt payments</span>
          <span className="w-28 text-right text-[13px] text-muted">—</span>
          <span className="num w-28 text-right text-[13px]">{formatCents(payFirst.otherSavingCents)}</span>
        </li>
      </ul>
      {payFirst.plannedCents === 0 ? (
        <p className="border-t border-line px-6 py-3 text-[12px] text-muted md:px-7">
          Nothing is set aside automatically. Fund a goal with a share of every income so saving happens first.
        </p>
      ) : null}
    </section>
  );
}

function BudgetGroup({
  title,
  subtitle,
  group,
  saving,
  onSave,
  onMoveMoney,
}: {
  title: string;
  subtitle: string;
  group: PlanGroup;
  saving: boolean;
  onSave: (item: BudgetItem) => void;
  onMoveMoney: (category: PlanCategory) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <GroupHeader
        title={title}
        subtitle={subtitle}
        right={
          <p className="num text-right text-[13px] text-muted">
            <span className="text-foreground">{formatCents(group.spentCents)}</span> of {formatCents(group.plannedCents)}
          </p>
        }
      />
      {group.categories.length ? (
        <ul className="divide-y divide-line">
          {group.categories.map((category) => (
            <CategoryBudgetRow
              key={category.categoryId}
              category={category}
              saving={saving}
              onSave={onSave}
              onMoveMoney={onMoveMoney}
            />
          ))}
        </ul>
      ) : (
        <p className="px-6 py-6 text-[13px] text-muted md:px-7">No categories here yet.</p>
      )}
    </section>
  );
}

function GroupHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line px-6 py-5 md:px-7">
      <div>
        <h2 className="text-[15px]">{title}</h2>
        <p className="text-[13px] text-muted">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
