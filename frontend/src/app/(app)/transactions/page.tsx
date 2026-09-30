"use client";

import { ArrowsLeftRight, CaretLeft, CaretRight, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CategoryIcon } from "@/components/categories/IconPicker";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Transaction, TransactionFilters, TransactionType } from "@/lib/api/transactions";
import { useDeleteTransaction } from "@/lib/hooks/useDeleteTransaction";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";

const PAGE_SIZE = 10;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMonth, setFilterMonth] = useState<number | undefined>();
  const [filterYear, setFilterYear] = useState<number | undefined>();
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [categoryId, setCategoryId] = useState("");
  const [formTransaction, setFormTransaction] = useState<Transaction | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const reduceMotion = useReducedMotion();

  const filters = useMemo<TransactionFilters>(
    () => ({
      page,
      limit: PAGE_SIZE,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      month: filterMonth,
      year: filterYear,
      type: type === "all" ? undefined : type,
      categoryId: categoryId || undefined,
    }),
    [categoryId, endDate, filterMonth, filterYear, page, startDate, type],
  );

  const { data, isLoading, isFetching } = useTransactions(filters);
  const deleteTransaction = useDeleteTransaction();
  const transactions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const activeFilterCount = [startDate, endDate, filterMonth, filterYear, type !== "all" ? type : "", categoryId].filter(
    Boolean,
  ).length;

  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, string>();
    transactions.forEach((transaction) => {
      uniqueCategories.set(transaction.category.id, transaction.category.name);
    });
    if (categoryId && !uniqueCategories.has(categoryId)) {
      uniqueCategories.set(categoryId, "Selected category");
    }
    return Array.from(uniqueCategories, ([id, name]) => ({ id, name }));
  }, [categoryId, transactions]);

  const pageIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amountCents, 0);
  const pageExpense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amountCents, 0);

  function resetPage<T>(setter: (value: T) => void, value: T) {
    setPage(1);
    setter(value);
  }

  function resetFilters() {
    setStartDate("");
    setEndDate("");
    setFilterMonth(undefined);
    setFilterYear(undefined);
    setType("all");
    setCategoryId("");
    setPage(1);
  }

  function openAddModal() {
    setFormTransaction(null);
    setIsFormModalOpen(true);
  }

  function openEditModal(transaction: Transaction) {
    setFormTransaction(transaction);
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setIsFormModalOpen(false);
    setFormTransaction(null);
  }

  function confirmDelete() {
    if (!transactionToDelete) return;
    // The row is removed optimistically, so close the dialog without waiting
    // for the server; a failure restores the row and shows a toast.
    deleteTransaction.mutate(transactionToDelete.id);
    if (transactions.length === 1 && page > 1) {
      setPage((current) => current - 1);
    }
    setTransactionToDelete(null);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Transactions"
        title="Every entry, in one ledger."
        aside="Filter by time, type, or category."
        actions={
          <Button onClick={openAddModal}>
            <Plus size={14} weight="bold" aria-hidden="true" />
            Add transaction
          </Button>
        }
      />

      <Reveal>
        <section className="card p-5 md:p-6" aria-label="Filters">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SegmentedControl
              label="Transaction type"
              value={type}
              onChange={(value) => resetPage(setType, value)}
              options={[
                { value: "all", label: "All" },
                { value: "income", label: "Income" },
                { value: "expense", label: "Expenses" },
              ]}
            />
            <div className="flex items-center gap-3 text-[13px]">
              <AnimatePresence>
                {activeFilterCount > 0 ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="tag bg-blue-bg text-blue-fg"
                  >
                    {activeFilterCount} active
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
              >
                Reset filters
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-5">
            <label>
              <span className="label text-muted">Period month</span>
              <select
                value={filterMonth ?? ""}
                className="field h-10"
                onChange={(event) =>
                  resetPage(setFilterMonth, event.target.value ? Number(event.target.value) : undefined)
                }
              >
                <option value="">All months</option>
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label text-muted">Period year</span>
              <select
                value={filterYear ?? ""}
                className="field h-10"
                onChange={(event) =>
                  resetPage(setFilterYear, event.target.value ? Number(event.target.value) : undefined)
                }
              >
                <option value="">All years</option>
                {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label text-muted">From date</span>
              <input
                type="date"
                value={startDate}
                className="field h-10"
                onChange={(event) => resetPage(setStartDate, event.target.value)}
              />
            </label>
            <label>
              <span className="label text-muted">To date</span>
              <input
                type="date"
                value={endDate}
                className="field h-10"
                onChange={(event) => resetPage(setEndDate, event.target.value)}
              />
            </label>
            <label className="sm:col-span-2 lg:col-span-1">
              <span className="label text-muted">Category</span>
              <select value={categoryId} className="field h-10" onChange={(event) => resetPage(setCategoryId, event.target.value)}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </Reveal>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] text-muted">
          <p className="num">
            {total} {total === 1 ? "transaction" : "transactions"}
            {isFetching && !isLoading ? <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted align-middle" /> : null}
          </p>
          {transactions.length ? (
            <p className="num flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-income" /> Income on this page {formatCurrency(pageIncome)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-expense" /> Spent on this page {formatCurrency(pageExpense)}
              </span>
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <TransactionListSkeleton />
        ) : transactions.length === 0 ? (
          <EmptyState onAdd={openAddModal} filtered={activeFilterCount > 0} onReset={resetFilters} />
        ) : (
          <div className="card overflow-hidden" aria-busy={isFetching}>
            <div className="hidden grid-cols-[110px_90px_minmax(160px,1.2fr)_minmax(160px,2fr)_140px_84px] gap-4 border-b border-line px-6 py-3 text-[12px] text-muted md:grid">
              <span title="The month and year this transaction is attributed to">Period</span>
              <span title="Date money was physically received or paid">Date</span>
              <span>Category</span>
              <span>Note</span>
              <span className="text-right">Amount</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false} mode="popLayout">
                {transactions.map((transaction, index) => (
                  <motion.li
                    key={transaction.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.025 }}
                    className="group relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-surface-2/60 md:grid-cols-[110px_90px_minmax(160px,1.2fr)_minmax(160px,2fr)_140px_84px] md:px-6 md:py-3.5"
                  >
                    <span className="num hidden text-[14px] text-foreground md:block">
                      {new Date(transaction.transactionYear, transaction.transactionMonth - 1, 1).toLocaleString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="num hidden text-[13px] text-muted md:block">
                      {new Date(transaction.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${transaction.category.color ?? "#868685"} 14%, transparent)`,
                          color: transaction.category.color ?? "#868685",
                        }}
                      >
                        <CategoryIcon name={transaction.category.icon} size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-foreground">{transaction.category.name}</span>
                        <span className="num block truncate text-[12px] text-muted md:hidden">
                          {new Date(transaction.transactionYear, transaction.transactionMonth - 1, 1).toLocaleString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                          {transaction.note ? ` · ${transaction.note}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="hidden truncate text-[14px] text-muted md:block">
                      {transaction.note || <span className="text-faint">No note</span>}
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="num text-[14px] text-foreground">
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amountCents)}
                      </span>
                      <span
                        className={cn(
                          "tag mt-1 px-1.5 py-0 text-[9px]",
                          transaction.type === "income" ? "bg-green-bg text-green-fg" : "bg-red-bg text-red-fg",
                        )}
                      >
                        {transaction.type}
                      </span>
                    </span>
                    <span className="col-span-2 flex justify-end gap-1 md:col-span-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label="Edit transaction"
                        className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                        onClick={() => openEditModal(transaction)}
                      >
                        <PencilSimple size={14} weight="bold" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete transaction"
                        className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-red-bg hover:text-red-fg"
                        onClick={() => setTransactionToDelete(transaction)}
                      >
                        <Trash size={14} weight="bold" aria-hidden="true" />
                      </button>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 px-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="num text-[13px] text-muted">
            Page {page} of {totalPages} · {total} total transactions
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canGoPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <CaretLeft size={12} weight="bold" aria-hidden="true" />
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={!canGoNext} onClick={() => setPage((current) => current + 1)}>
              Next
              <CaretRight size={12} weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      <Modal
        open={isFormModalOpen}
        title={formTransaction ? "Edit transaction" : "Add transaction"}
        description={formTransaction ? "Update the details of this entry." : "Record money coming in or going out."}
        onClose={closeFormModal}
      >
        <TransactionForm transaction={formTransaction} onCancel={closeFormModal} onSuccess={closeFormModal} />
      </Modal>

      <Modal
        open={transactionToDelete !== null}
        title="Delete transaction?"
        size="sm"
        onClose={() => {
          if (!deleteTransaction.isPending) setTransactionToDelete(null);
        }}
      >
        <p className="text-[14px] leading-relaxed text-muted">
          This will remove the {transactionToDelete?.type} transaction for{" "}
          <span className="num text-foreground">
            {transactionToDelete ? formatCurrency(transactionToDelete.amountCents) : ""}
          </span>
          . This action cannot be undone from the app.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <Button variant="secondary" disabled={deleteTransaction.isPending} onClick={() => setTransactionToDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deleteTransaction.isPending} onClick={confirmDelete}>
            {deleteTransaction.isPending ? "Deleting…" : "Delete transaction"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function TransactionListSkeleton() {
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-6 py-4">
          <div className="skeleton h-8 w-8" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd, filtered, onReset }: { onAdd: () => void; filtered: boolean; onReset: () => void }) {
  return (
    <div className="card relative flex flex-col items-center justify-center overflow-clip px-6 py-20 text-center">
      <div className="dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden="true" />
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="relative grid h-12 w-12 place-items-center rounded-[10px] border border-line bg-surface text-foreground"
      >
        <ArrowsLeftRight size={18} weight="bold" />
      </motion.div>
      <h2 className="relative mt-5 text-[18px] tracking-[-0.01em]">
        {filtered ? "Nothing matches these filters" : "No transactions yet"}
      </h2>
      <p className="relative mt-1.5 max-w-sm text-[14px] text-muted">
        {filtered
          ? "Widen the period or clear a filter to see more of your activity."
          : "Add your first income or expense to start building your picture."}
      </p>
      <div className="relative mt-6 flex gap-2">
        {filtered ? (
          <Button variant="secondary" onClick={onReset}>
            Reset filters
          </Button>
        ) : null}
        <Button onClick={onAdd}>
          <Plus size={14} weight="bold" /> Add transaction
        </Button>
      </div>
    </div>
  );
}
