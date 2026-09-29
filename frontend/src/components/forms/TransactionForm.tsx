"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarBlank, Warning } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Transaction } from "@/lib/api/transactions";
import { useCategories } from "@/lib/hooks/useCategories";
import { useCreateTransaction } from "@/lib/hooks/useCreateTransaction";
import { useUpdateTransaction } from "@/lib/hooks/useUpdateTransaction";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiClient } from "@/lib/api/client";

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid("Choose a category."),
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
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type TransactionFormProps = {
  transaction?: Transaction | null;
  onSuccess: () => void;
  onCancel: () => void;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const defaultValues: TransactionFormValues = {
  type: "expense",
  categoryId: "",
  amount: 0,
  transactionMonth: new Date().getMonth() + 1,
  transactionYear: new Date().getFullYear(),
  date: toDateInputValue(new Date().toISOString()),
  note: "",
};

export function TransactionForm({ transaction, onSuccess, onCancel }: TransactionFormProps) {
  const toast = useToast();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const isEditing = Boolean(transaction);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [projectedBalance, setProjectedBalance] = useState<number | null>(null);
  const [isProjectedLow, setIsProjectedLow] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  });

  const selectedType = watch("type");
  const amountValue = watch("amount");
  const selectedDate = watch("date");
  const note = watch("note") ?? "";
  const periodMonth = watch("transactionMonth");
  const periodYear = watch("transactionYear");
  const futureDateWarning = selectedDate && new Date(`${selectedDate}T00:00:00`) > startOfToday();
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === selectedType),
    [categories, selectedType],
  );
  const submitting = createTransaction.isPending || updateTransaction.isPending;

  useEffect(() => {
    const values = transaction
      ? {
          type: transaction.type,
          categoryId: transaction.categoryId,
          amount: transaction.amountCents / 100,
          transactionMonth: transaction.transactionMonth,
          transactionYear: transaction.transactionYear,
          date: toDateInputValue(transaction.date),
          note: transaction.note ?? "",
        }
      : defaultValues;

    reset(values);
    setAmountDisplay(formatAmount(values.amount));
  }, [reset, transaction]);

  useEffect(() => {
    if (!amountValue || amountValue <= 0) {
      setProjectedBalance(null);
      return;
    }
    const amountCents = Math.round(amountValue * 100);
    apiClient<{
      data?: { projectedBalanceCents: number; isLowBalance: boolean };
      projectedBalanceCents: number;
      isLowBalance: boolean;
    }>(`/transactions/projected-balance?amount=${amountCents}&type=${selectedType}`)
      .then((response) => {
        const result = response.data ?? response;
        setProjectedBalance(result.projectedBalanceCents);
        setIsProjectedLow(result.isLowBalance);
      })
      .catch(() => setProjectedBalance(null));
  }, [amountValue, selectedType]);

  function handleTypeChange(nextType: "income" | "expense") {
    setValue("type", nextType, { shouldDirty: true, shouldValidate: true });
    if (nextType !== selectedType) {
      setValue("categoryId", "", { shouldDirty: true, shouldValidate: true });
    }
  }

  function handleAmountChange(value: string) {
    const cents = Number(value.replace(/\D/g, ""));
    const amount = cents / 100;
    setAmountDisplay(cents ? formatAmount(amount) : "");
    setValue("amount", amount, { shouldDirty: true, shouldValidate: true });
  }

  function submit(values: TransactionFormValues) {
    const payload = { ...values, note: values.note?.trim() || undefined };

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
      onSuccess: () => {
        toast.success("Transaction created.");
        onSuccess();
      },
    });
  }

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
          placeholder="$0.00"
          onChange={(event) => handleAmountChange(event.target.value)}
        />
        <input type="hidden" {...register("amount")} />
        {errors.amount ? <FieldError message={errors.amount.message} /> : null}
        <AnimatePresence>
          {selectedType === "expense" && projectedBalance !== null && isProjectedLow ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-3 flex items-start gap-2 rounded-[6px] bg-yellow-bg px-3 py-2 text-[12px] text-yellow-fg">
                <Warning size={13} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  This expense will bring your balance to{" "}
                  <strong className="num font-medium">
                    {projectedBalance < 0 ? "-" : ""}${(Math.abs(projectedBalance) / 100).toFixed(2)}
                  </strong>
                  {projectedBalance < 0 ? " (negative)" : ""} — below your low-balance threshold.
                </span>
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

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
      </div>

      <div>
        <span className="label">Transaction for</span>
        <p className="hint mb-2">
          The month this income or expense belongs to — not necessarily when money changed hands.
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
          Date received or paid
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
          {submitting ? "Saving…" : isEditing ? "Save transaction" : "Add transaction"}
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
