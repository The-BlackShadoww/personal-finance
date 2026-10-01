"use client";

import { ArrowsClockwise, ArrowsLeftRight } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type KeyboardEvent } from "react";
import { CategoryIcon } from "@/components/categories/IconPicker";
import type { BudgetItem, PlanCategory } from "@/lib/api/budgets";
import { cn } from "@/lib/utils/cn";
import { currencySymbol, formatCents, parseAmountInput } from "@/lib/utils/money";

const toInput = (cents: number | null) => (cents === null ? "" : String(cents / 100));

/**
 * One category in the plan: an inline budget input (saved on blur or Enter;
 * empty removes it), a rollover toggle, and spending against what is
 * available. Colours stay neutral until 80% is spent.
 */
export function CategoryBudgetRow({
  category,
  saving,
  onSave,
  onMoveMoney,
}: {
  category: PlanCategory;
  saving: boolean;
  onSave: (item: BudgetItem) => void;
  onMoveMoney: (category: PlanCategory) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(toInput(category.amountCents));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setValue(toInput(category.amountCents));
    setInvalid(false);
  }, [category.amountCents]);

  function commit() {
    const parsed = parseAmountInput(value);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const cents = parsed === null ? null : Math.round(parsed * 100);
    if (cents === category.amountCents) return;
    onSave({ categoryId: category.categoryId, amount: cents === null ? null : cents / 100, rollover: category.rollover });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setValue(toInput(category.amountCents));
      event.currentTarget.blur();
    }
  }

  const available = category.availableCents;
  const share = available && available > 0 ? Math.min(1, category.spentCents / available) : category.spentCents > 0 ? 1 : 0;
  const color = category.color ?? "#868685";

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 md:grid-cols-[minmax(160px,1.2fr)_150px_minmax(180px,2fr)_auto] md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          <CategoryIcon name={category.icon} size={14} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px]">{category.name}</p>
          <p className="num truncate text-[12px] text-muted">
            {category.averageCents > 0 ? `${formatCents(category.averageCents, 0)} avg, last 3 months` : "Nothing in the last 3 months"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:order-none">
        <div className="relative w-full">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
            {currencySymbol()}
          </span>
          <input
            aria-label={`${category.name} budget`}
            inputMode="decimal"
            autoComplete="off"
            className={cn("field num h-9 pl-7 text-[13px]", invalid && "border-red-fg")}
            placeholder={category.suggestedCents > 0 ? String(Math.round(category.suggestedCents / 100)) : "No budget"}
            value={value}
            disabled={saving}
            onChange={(event) => setValue(event.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
        </div>
        <button
          type="button"
          aria-pressed={category.rollover}
          aria-label={`Roll ${category.name} leftovers into next month`}
          title={category.rollover ? "Leftovers roll into next month" : "Roll leftovers into next month"}
          disabled={category.amountCents === null || saving}
          onClick={() =>
            onSave({ categoryId: category.categoryId, amount: (category.amountCents ?? 0) / 100, rollover: !category.rollover })
          }
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border transition-colors disabled:opacity-30",
            category.rollover ? "border-foreground text-foreground" : "border-line text-muted hover:text-foreground",
          )}
        >
          <ArrowsClockwise size={13} weight="bold" />
        </button>
      </div>

      <div className="col-span-2 md:col-span-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className={cn(
              "h-full rounded-full",
              category.status === "over" ? "bg-red-fg" : category.status === "warning" ? "bg-yellow-fg" : "bg-foreground/70",
            )}
            style={{ originX: 0 }}
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: share }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="num mt-1.5 text-[12px] text-muted">
          {formatCents(category.spentCents)} spent
          {available !== null ? <> of {formatCents(available)}</> : null}
          {category.carryCents !== 0 ? (
            <span className={category.carryCents < 0 ? "text-red-fg" : undefined}>
              {" "}
              ({category.carryCents > 0 ? "+" : ""}
              {formatCents(category.carryCents)} carried)
            </span>
          ) : null}
        </p>
      </div>

      <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-1">
        {category.remainingCents !== null ? (
          <span
            className={cn(
              "num text-[13px]",
              category.remainingCents < 0 ? "text-red-fg" : category.status === "warning" ? "text-yellow-fg" : "text-foreground",
            )}
          >
            {category.remainingCents < 0
              ? `${formatCents(-category.remainingCents)} over`
              : `${formatCents(category.remainingCents)} left`}
          </span>
        ) : null}
        {category.status === "over" ? (
          <button
            type="button"
            onClick={() => onMoveMoney(category)}
            title="Move money from another category"
            className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowsLeftRight size={12} weight="bold" /> Move money
          </button>
        ) : null}
      </div>
    </li>
  );
}
