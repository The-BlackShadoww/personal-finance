"use client";

import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ColorPicker } from "@/components/categories/ColorPicker";
import { CategoryIcon, IconPicker } from "@/components/categories/IconPicker";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { SectorAllocation } from "@/lib/api/account";
import {
  useAccountSummary,
  useCreateSector,
  useDeleteSector,
  useSetupAccount,
  useUpdateSector,
} from "@/lib/hooks/useAccount";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { currencySymbol } from "@/lib/utils/money";
import { Notice, SectionTitle } from "./ui";

type SectorValues = {
  name: string;
  percentage: number;
  color: string;
  icon: string;
  targetAmount: string;
};

const blank: SectorValues = {
  name: "",
  percentage: 5,
  color: "#6b7280",
  icon: "piggy-bank",
  targetAmount: "",
};

export function AccountSettingsTab() {
  const { data: summary, isLoading } = useAccountSummary();
  const setup = useSetupAccount();
  const create = useCreateSector();
  const update = useUpdateSector();
  const remove = useDeleteSector();
  const [initialBalance, setInitialBalance] = useState(0);
  const [threshold, setThreshold] = useState(5000);
  const [sector, setSector] = useState<SectorValues | null>(null);
  const [editing, setEditing] = useState<SectorAllocation | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const total = summary?.sectors.reduce((sum, item) => sum + item.percentage, 0) ?? 0;
  const available = 99 - total + (editing?.percentage ?? 0);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await setup.mutateAsync({
        initialBalance: Math.round(initialBalance),
        lowBalanceThreshold: Math.round(threshold),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save configuration");
    }
  }

  async function saveSector(e: React.FormEvent) {
    e.preventDefault();
    if (!sector) return;
    setError(null);
    try {
      const data = {
        ...sector,
        targetAmount: sector.targetAmount ? Math.round(Number(sector.targetAmount)) : undefined,
      };
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else await create.mutateAsync(data);
      setSector(null);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save sector");
    }
  }

  return (
    <div className="max-w-2xl space-y-12">
      <section>
        <SectionTitle
          title="Account configuration"
          description="Your running balance is recalculated from this starting balance and every transaction."
        />
        <form onSubmit={saveConfig} className="grid gap-5 sm:grid-cols-2">
          <NumberInput id="initial-balance" label="Default account opening balance" prefix={currencySymbol()} value={initialBalance} onChange={setInitialBalance} />
          <NumberInput id="threshold" label="Low-balance threshold" prefix={currencySymbol()} value={threshold} onChange={setThreshold} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={setup.isPending}>
              {setup.isPending ? <Spinner /> : null}
              {setup.isPending ? "Saving…" : "Save configuration"}
            </Button>
          </div>
        </form>
      </section>

      <section className="border-t border-line pt-10">
        <SectionTitle
          title="Savings sectors"
          description="Split your balance into goals. Cash is calculated as the remainder."
          aside={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setSector(blank);
              }}
              disabled={available <= 0}
            >
              <Plus size={13} weight="bold" />
              New sector
            </Button>
          }
        />

        {/* Allocation meter */}
        <div className="rounded-[10px] bg-surface-2 p-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">
              Allocated <span className="num text-foreground">{total}%</span> of 99%
            </span>
            <span className="num text-muted">Cash receives {100 - total}%</span>
          </div>
          <div className="mt-3 flex h-2 gap-[2px] overflow-hidden rounded-[3px] bg-surface-3">
            {summary?.sectors.map((item, index) => (
              <motion.span
                key={item.id}
                className="h-full"
                style={{ backgroundColor: item.color }}
                initial={{ width: 0 }}
                animate={{ width: `${item.percentage}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
              />
            ))}
          </div>
        </div>

        <ul className="mt-4 space-y-0.5">
          <AnimatePresence initial={false}>
            {summary?.sectors.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="group overflow-hidden"
              >
                <div className="flex items-center gap-3.5 rounded-[8px] px-3 py-2.5 transition-colors hover:bg-surface-2">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
                    style={{ backgroundColor: `color-mix(in srgb, ${item.color} 14%, transparent)`, color: item.color }}
                  >
                    <CategoryIcon name={item.icon} size={16} />
                  </span>
                  <span className="flex-1 text-[14px]">
                    {item.name}
                    <span className="num ml-2 text-[13px] text-muted">{item.percentage}%</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit ${item.name}`}
                    className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                    onClick={() => {
                      setEditing(item);
                      setSector({
                        name: item.name,
                        percentage: item.percentage,
                        color: item.color,
                        icon: item.icon,
                        targetAmount: item.targetAmountCents ? String(item.targetAmountCents / 100) : "",
                      });
                    }}
                  >
                    <PencilSimple size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-red-bg hover:text-red-fg"
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <AnimatePresence>
          {sector && (
            <motion.form
              onSubmit={saveSector}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-5 space-y-6 rounded-[10px] border border-line bg-surface-2/50 p-5 md:p-6">
                <h3 className="text-[15px]">{editing ? `Edit ${editing.name}` : "New savings sector"}</h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="label">Name</span>
                    <input
                      required
                      maxLength={100}
                      value={sector.name}
                      onChange={(e) => setSector({ ...sector, name: e.target.value })}
                      placeholder="Emergency fund"
                      className="field"
                    />
                  </label>
                  <NumberInput
                    id="sector-percentage"
                    label={`Percentage (available: ${available}%)`}
                    suffix="%"
                    value={sector.percentage}
                    onChange={(value) => setSector({ ...sector, percentage: value })}
                    max={available}
                    min={1}
                  />
                  <label className="block">
                    <span className="label">
                      Savings goal <span className="text-faint">optional</span>
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">{currencySymbol()}</span>
                      <input
                        type="number"
                        min="1"
                        value={sector.targetAmount}
                        onChange={(e) => setSector({ ...sector, targetAmount: e.target.value })}
                        className="field num pl-7"
                      />
                    </div>
                  </label>
                </div>
                <div>
                  <span className="label">Color</span>
                  <ColorPicker value={sector.color} onChange={(color) => setSector({ ...sector, color })} />
                </div>
                <div>
                  <span className="label">Icon</span>
                  <IconPicker value={sector.icon} onChange={(icon) => setSector({ ...sector, icon })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSector(null);
                      setEditing(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={create.isPending || update.isPending}>
                    Save sector
                  </Button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      <Notice show={Boolean(error)} tone="error">
        {error}
      </Notice>
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
