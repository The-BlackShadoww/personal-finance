"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarBlank, Warning } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Account } from "@/lib/api/accounts";
import { goalsApi } from "@/lib/api/goals";
import type { CreatedTransaction, Transaction, TransactionPayload, TransactionType } from "@/lib/api/transactions";
import { useCategories } from "@/lib/hooks/useCategories";
import { useCreateTransaction } from "@/lib/hooks/useCreateTransaction";
import { useUpdateTransaction } from "@/lib/hooks/useUpdateTransaction";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useAccountSummary } from "@/lib/hooks/useAccount";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useGoals } from "@/lib/hooks/useGoals";
import { useAddWishlistItem, useWishlist } from "@/lib/hooks/useHabits";
import { invalidateFinancialData } from "@/lib/hooks/invalidateFinancialData";
import { formatCents, formatMoney } from "@/lib/utils/money";

const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    accountId: z.string().uuid("Choose an account."),
    counterAccountId: z.string(),
    categoryId: z.string(),
    amount: z.coerce.number().positive("Enter an amount greater than zero."),
    transactionMonth: z.number().int().min(1).max(12),
    transactionYear: z.number().int().min(2000).max(2100),
    date: z
      .string()
      .min(1, "Choose a date.")
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "Choose a valid date.",
      }),
    note: z.string().max(500, "Keep notes under 500 characters.").optional(),
  })
  .superRefine((values, context) => {
    if (values.type === "transfer") {
      if (!z.string().uuid().safeParse(values.counterAccountId).success) {
        context.addIssue({ code: "custom", path: ["counterAccountId"], message: "Choose where the money goes." });
      } else if (values.counterAccountId === values.accountId) {
        context.addIssue({ code: "custom", path: ["counterAccountId"], message: "Choose a different account." });
      }
    } else if (!z.string().uuid().safeParse(values.categoryId).success) {
      context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a category." });
    }
  });

type TransactionFormValues = z.infer<typeof transactionSchema>;

type TransactionFormProps = {
  transaction?: Transaction | null;
  /** Starting values for a new expense, e.g. buying an item from the cooling-off list. */
  prefill?: { amount: number; categoryId?: string | null; note?: string };
  onSuccess: () => void;
  onCancel: () => void;
  /** Called with the new entry after it is created. */
  onCreated?: (created: CreatedTransaction) => void;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The account new entries start in on this browser; a per-viewer convenience.
const LAST_ACCOUNT_KEY = "pf-last-account-id";

function readLastAccountId() {
  try {
    return window.localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function rememberAccountId(id: string) {
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    // Storage unavailable: the default account is used next time.
  }
}

const defaultValues: TransactionFormValues = {
  type: "expense",
  accountId: "",
  counterAccountId: "",
  categoryId: "",
  amount: 0,
  transactionMonth: new Date().getMonth() + 1,
  transactionYear: new Date().getFullYear(),
  date: toDateInputValue(new Date().toISOString()),
  note: "",
};

/** What a transfer does, in plain words. */
function describeTransfer(from: Account | undefined, to: Account | undefined) {
  if (!from || !to) return null;
  if (from.nature === "liability") return "Borrowing — what you owe goes up.";
  if (to.nature === "liability") return "Paying down debt. Not counted as spending.";
  if (to.kind === "savings") return "Saving. Not counted as spending — your savings rate stays honest.";
  if (to.kind === "investment" || to.kind === "retirement") return "Investing. Not counted as spending.";
  return "Moving money between your own accounts.";
}

/** Change to liquid (available) money caused by an entry. */
function liquidDelta(type: TransactionType, amountCents: number, from?: Account, to?: Account) {
  const isLiquid = (account?: Account) => Boolean(account && account.isLiquid && account.nature === "asset");
  if (type === "income") return isLiquid(from) ? amountCents : 0;
  if (type === "expense") return isLiquid(from) ? -amountCents : 0;
  return (isLiquid(to) ? amountCents : 0) - (isLiquid(from) ? amountCents : 0);
}

export function TransactionForm({ transaction, prefill, onSuccess, onCancel, onCreated }: TransactionFormProps) {
  const toast = useToast();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  // Archived accounts stay listed so an entry recorded in one can be edited.
  const { data: accountsData, isLoading: accountsLoading } = useAccounts(true);
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const isEditing = Boolean(transaction);
  const { data: accountSummary } = useAccountSummary();
  const [amountDisplay, setAmountDisplay] = useState("");
  const queryClient = useQueryClient();
  const { data: goalsData } = useGoals();
  const [payFromGoal, setPayFromGoal] = useState(true);
  const { data: wishlist } = useWishlist();
  const addToWishlist = useAddWishlistItem();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    getValues,
    watch,
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  });

  const selectedType = watch("type");
  const amountValue = watch("amount");
  const accountId = watch("accountId");
  const counterAccountId = watch("counterAccountId");
  const selectedDate = watch("date");
  const note = watch("note") ?? "";
  const periodMonth = watch("transactionMonth");
  const periodYear = watch("transactionYear");
  const isTransfer = selectedType === "transfer";
  const futureDateWarning = selectedDate && new Date(`${selectedDate}T00:00:00`) > startOfToday();
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === selectedType),
    [categories, selectedType],
  );
  const accounts = useMemo(() => {
    const all = accountsData?.accounts ?? [];
    const current = [transaction?.accountId, transaction?.counterAccountId];
    return all.filter((account) => account.archivedAt === null || current.includes(account.id));
  }, [accountsData, transaction]);
  const categoryId = watch("categoryId");
  // A sinking fund linked to this category can pay for the expense.
  const fundingGoal =
    !isEditing && selectedType === "expense"
      ? goalsData?.goals.find(
          (goal) => goal.categoryId === categoryId && goal.archivedAt === null && goal.balanceCents > 0,
        )
      : undefined;
  // The cooling-off rule: a want at or above the threshold can wait instead.
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const coolingOff = wishlist?.settings;
  const offerCoolingOff =
    !isEditing &&
    !prefill &&
    selectedType === "expense" &&
    coolingOff?.thresholdCents != null &&
    selectedCategory !== undefined &&
    !selectedCategory.essential &&
    Math.round(amountValue * 100) >= coolingOff.thresholdCents;
  const fromAccount = accounts.find((account) => account.id === accountId);
  const toAccount = accounts.find((account) => account.id === counterAccountId);
  const submitting = createTransaction.isPending || updateTransaction.isPending;

  useEffect(() => {
    const values: TransactionFormValues = transaction
      ? {
          type: transaction.type,
          accountId: transaction.accountId,
          counterAccountId: transaction.counterAccountId ?? "",
          categoryId: transaction.categoryId ?? "",
          amount: transaction.amountCents / 100,
          transactionMonth: transaction.transactionMonth,
          transactionYear: transaction.transactionYear,
          date: toDateInputValue(transaction.date),
          note: transaction.note ?? "",
        }
      : prefill
        ? {
            ...defaultValues,
            type: "expense",
            amount: prefill.amount,
            categoryId: prefill.categoryId ?? "",
            note: prefill.note ?? "",
          }
        : defaultValues;

    reset(values);
    setAmountDisplay(formatAmount(values.amount));
    // Only on open: prefill is an object recreated by the parent each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, transaction]);

  // New entries start in the last-used account, else the default one.
  useEffect(() => {
    if (transaction || !accountsData || getValues("accountId")) return;
    const active = accountsData.accounts.filter((account) => account.archivedAt === null);
    const lastUsed = readLastAccountId();
    const initial = active.find((account) => account.id === lastUsed) ?? active.find((account) => account.isDefault);
    if (initial) setValue("accountId", initial.id);
  }, [accountsData, getValues, setValue, transaction]);

  // Editing an entry already counted in the balance would double-count it,
  // so the projection only applies to new entries.
  const delta =
    !isEditing && amountValue > 0
      ? liquidDelta(selectedType, Math.round(amountValue * 100), fromAccount, toAccount)
      : 0;
  const projectedBalance = accountSummary && delta < 0 ? accountSummary.availableCents + delta : null;
  const isProjectedLow =
    projectedBalance !== null && accountSummary !== undefined
      ? projectedBalance < accountSummary.lowBalanceThresholdCents
      : false;

  function handleTypeChange(nextType: TransactionType) {
    setValue("type", nextType, { shouldDirty: true, shouldValidate: false });
    if (nextType !== selectedType) {
      setValue("categoryId", "", { shouldDirty: true });
      setValue("counterAccountId", "", { shouldDirty: true });
    }
  }

  function handleAmountChange(value: string) {
    const cents = Number(value.replace(/\D/g, ""));
    const amount = cents / 100;
    setAmountDisplay(cents ? formatAmount(amount) : "");
    setValue("amount", amount, { shouldDirty: true, shouldValidate: true });
  }

  function submit(values: TransactionFormValues) {
    const { counterAccountId: destination, categoryId, ...rest } = values;
    const payload: TransactionPayload = {
      ...rest,
      note: values.note?.trim() || undefined,
      ...(values.type === "transfer" ? { counterAccountId: destination } : { categoryId }),
      ...(fundingGoal && payFromGoal ? { payFromGoalId: fundingGoal.id } : {}),
    };

    if (transaction) {
      updateTransaction.mutate(
        { id: transaction.id, payload },
        {
          onSuccess: () => {
            toast.success("Transaction updated.");
            onSuccess();
          },
        },
      );
      return;
    }

    createTransaction.mutate(payload, {
      onSuccess: (created) => {
        rememberAccountId(values.accountId);
        announce(created);
        onCreated?.(created);
        onSuccess();
      },
    });
  }

  function coolOff() {
    if (!selectedCategory) return;
    const name = note.trim() || selectedCategory.name;
    addToWishlist.mutate(
      { name: name.slice(0, 120), amount: amountValue, categoryId: selectedCategory.id },
      {
        onSuccess: () => {
          toast.success(`${name} is on your cooling-off list. Decide once the wait is over.`);
          onSuccess();
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add it to the list."),
      },
    );
  }

  /** Confirms the entry, including what goals did because of it. */
  function announce(created: CreatedTransaction) {
    if (created.goalAllocation.length) {
      const total = created.goalAllocation.reduce((sum, item) => sum + item.amountCents, 0);
      const parts = created.goalAllocation.map((item) => `${item.name} ${formatCents(item.amountCents)}`).join(" · ");
      // The form closes on success, so Undo talks to the API directly.
      toast.success(`Income recorded. Set aside ${formatCents(total)}: ${parts}`, {
        label: "Undo",
        onClick: () => {
          goalsApi
            .undoAllocation(created.id)
            .then(() => invalidateFinancialData(queryClient))
            .then(() => toast.success("Set-aside undone; the money is available to spend."))
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not undo."));
        },
      });
      return;
    }
    if (created.goalPayment) {
      toast.success(`Expense recorded. Paid ${formatCents(created.goalPayment.amountCents)} from ${created.goalPayment.name}.`);
      return;
    }
    toast.success(created.type === "transfer" ? "Transfer recorded." : "Transaction created.");
  }

  const accountOptions = (exclude?: string) => {
    const usable = accounts.filter((account) => account.id !== exclude);
    return [
      { label: "Money you own", items: usable.filter((account) => account.nature === "asset") },
      { label: "Money you owe", items: usable.filter((account) => account.nature === "liability") },
    ]
      .filter((group) => group.items.length > 0)
      .map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archivedAt ? " (archived)" : ""}
            </option>
          ))}
        </optgroup>
      ));
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(submit)}>
      <SegmentedControl
        label="Transaction type"
        value={selectedType}
        onChange={handleTypeChange}
        fullWidth
        options={[
          {
            value: "expense",
            label: (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-expense" /> Expense
              </>
            ),
          },
          {
            value: "income",
            label: (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-income" /> Income
              </>
            ),
          },
          {
            value: "transfer",
            label: (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-muted" /> Transfer
              </>
            ),
          },
        ]}
      />
      <input type="hidden" {...register("type")} />
      {errors.type ? <FieldError message={errors.type.message} /> : null}

      {/* Hero amount input */}
      <div className="rounded-[10px] bg-surface-2 px-5 pb-4 pt-5">
        <label htmlFor="amount" className="text-[13px] text-muted">
          Amount
        </label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amountDisplay}
          aria-invalid={errors.amount ? "true" : "false"}
          className="num mt-1 w-full border-0 bg-transparent p-0 text-[40px] font-[360] leading-tight tracking-[-0.03em] text-foreground outline-none placeholder:text-ghost"
          placeholder={formatMoney(0)}
          onChange={(event) => handleAmountChange(event.target.value)}
        />
        <input type="hidden" {...register("amount")} />
        {errors.amount ? <FieldError message={errors.amount.message} /> : null}
        <AnimatePresence>
          {projectedBalance !== null && isProjectedLow ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-3 flex items-start gap-2 rounded-[6px] bg-yellow-bg px-3 py-2 text-[12px] text-yellow-fg">
                <Warning size={13} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  This will bring your available balance to{" "}
                  <strong className="num font-medium">{formatCents(projectedBalance)}</strong>
                  {projectedBalance < 0 ? " (negative)" : ""} — below your low-balance threshold.
                </span>
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {isTransfer ? (
        <div>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="label" htmlFor="accountId">From</label>
              <select id="accountId" className="field" disabled={accountsLoading} {...register("accountId")}>
                <option value="">{accountsLoading ? "Loading accounts…" : "Choose an account"}</option>
                {accountOptions()}
              </select>
            </div>
            <ArrowRight size={16} weight="bold" className="mb-3 hidden text-muted sm:block" aria-hidden="true" />
            <div>
              <label className="label" htmlFor="counterAccountId">To</label>
              <select
                id="counterAccountId"
                className="field"
                disabled={accountsLoading}
                aria-invalid={errors.counterAccountId ? "true" : "false"}
                {...register("counterAccountId")}
              >
                <option value="">Choose an account</option>
                {accountOptions(accountId)}
              </select>
            </div>
          </div>
          {errors.accountId ? <FieldError message={errors.accountId.message} /> : null}
          {errors.counterAccountId ? <FieldError message={errors.counterAccountId.message} /> : null}
          {describeTransfer(fromAccount, toAccount) ? (
            <p className="mt-2 text-[12px] text-muted">{describeTransfer(fromAccount, toAccount)}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="categoryId">
              Category
            </label>
            <select
              id="categoryId"
              className="field"
              disabled={categoriesLoading}
              aria-invalid={errors.categoryId ? "true" : "false"}
              {...register("categoryId")}
            >
              <option value="">{categoriesLoading ? "Loading categories…" : "Choose a category"}</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId ? <FieldError message={errors.categoryId.message} /> : null}
            {offerCoolingOff && coolingOff ? (
              <div className="mt-2 rounded-[8px] bg-surface-2 px-3 py-2.5 text-[12px] text-muted">
                A want above your {formatCents(coolingOff.thresholdCents ?? 0, 0)} cooling-off limit. Wait{" "}
                {coolingOff.hours % 24 === 0 ? `${coolingOff.hours / 24} days` : `${coolingOff.hours} hours`} first?
                <button
                  type="button"
                  onClick={coolOff}
                  disabled={addToWishlist.isPending}
                  className="mt-1 block text-foreground underline underline-offset-4 hover:opacity-70 disabled:opacity-50"
                >
                  Add to your cooling-off list instead
                </button>
              </div>
            ) : null}
            {fundingGoal ? (
              <label className="mt-2 flex items-start gap-2 text-[12px] text-foreground">
                <input
                  type="checkbox"
                  checked={payFromGoal}
                  onChange={(event) => setPayFromGoal(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--ds-foreground)]"
                />
                <span>
                  Pay from {fundingGoal.name}{" "}
                  <span className="text-muted">({formatCents(fundingGoal.balanceCents)} saved)</span>
                </span>
              </label>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="accountId">
              {selectedType === "income" ? "Received in" : "Paid from"}
            </label>
            <select
              id="accountId"
              className="field"
              disabled={accountsLoading}
              aria-invalid={errors.accountId ? "true" : "false"}
              {...register("accountId")}
            >
              <option value="">{accountsLoading ? "Loading accounts…" : "Choose an account"}</option>
              {accountOptions()}
            </select>
            {errors.accountId ? <FieldError message={errors.accountId.message} /> : null}
          </div>
        </div>
      )}

      <div>
        <span className="label">Transaction for</span>
        <p className="hint mb-2">
          The month this entry belongs to — not necessarily when money changed hands.
        </p>
        <div className="flex gap-2">
          <select
            aria-label="Period month"
            value={periodMonth}
            onChange={(event) => setValue("transactionMonth", parseInt(event.target.value, 10), { shouldValidate: true })}
            className="field flex-1"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Period year"
            value={periodYear}
            onChange={(event) => setValue("transactionYear", parseInt(event.target.value, 10), { shouldValidate: true })}
            className="field w-28"
          >
            {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
          <CalendarBlank size={12} weight="bold" aria-hidden="true" />
          Counted in{" "}
          <span className="text-foreground">
            {new Date(periodYear, periodMonth - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
          </span>
        </p>
      </div>

      <div>
        <label className="label" htmlFor="date">
          {isTransfer ? "Date moved" : "Date received or paid"}
        </label>
        <p className="hint mb-2">For your records only — it does not change which month the entry counts toward.</p>
        <input id="date" type="date" className="field" aria-invalid={errors.date ? "true" : "false"} {...register("date")} />
        {futureDateWarning ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-yellow-fg">
            <Warning size={12} weight="fill" aria-hidden="true" />
            This date is in the future.
          </p>
        ) : null}
        {errors.date ? <FieldError message={errors.date.message} /> : null}
      </div>

      <div>
        <label className="label" htmlFor="note">
          Note <span className="text-faint">optional</span>
        </label>
        <textarea id="note" rows={3} maxLength={500} className="field" placeholder="What was this for?" {...register("note")} />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          {errors.note ? <FieldError message={errors.note.message} /> : <span />}
          <span className="num text-[12px] text-faint">{note.length}/500</span>
        </div>
      </div>

      <div className="-mx-6 flex justify-end gap-2 border-t border-line px-6 pt-5 sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {submitting ? "Saving…" : isEditing ? "Save transaction" : isTransfer ? "Record transfer" : "Add transaction"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[12px] text-red-fg">{message}</p>;
}

function formatAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return formatMoney(amount);
}

function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
