"use client";

import { Archive, ArrowCounterClockwise, PencilSimple, Plus, Trash, Warning } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { AccountForm } from "@/components/accounts/AccountForm";
import { SectorAllocation } from "@/components/accounts/SectorAllocation";
import { CategoryIcon } from "@/components/categories/IconPicker";
import { Sparkline } from "@/components/charts/Sparkline";
import { PageHeader } from "@/components/layouts/PageHeader";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { Account, AccountPayload } from "@/lib/api/accounts";
import { ACCOUNT_KINDS } from "@/lib/accounts";
import { useAccountSummary } from "@/lib/hooks/useAccount";
import {
  useAccounts,
  useArchiveAccount,
  useCreateAccount,
  useDeleteAccount,
  useRestoreAccount,
  useUpdateAccount,
} from "@/lib/hooks/useAccounts";
import { cn } from "@/lib/utils/cn";
import { formatCents } from "@/lib/utils/money";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export default function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useAccounts(showArchived);
  const { data: summary } = useAccountSummary();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const archiveAccount = useArchiveAccount();
  const restoreAccount = useRestoreAccount();
  const deleteAccount = useDeleteAccount();
  const toast = useToast();
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  const accounts = data?.accounts ?? [];
  const assets = accounts.filter((account) => account.nature === "asset");
  const liabilities = accounts.filter((account) => account.nature === "liability");
  const saving = createAccount.isPending || updateAccount.isPending;
  const formError = (editing === "new" ? createAccount.error : updateAccount.error) as Error | null;

  function closeForm() {
    setEditing(null);
    createAccount.reset();
    updateAccount.reset();
  }

  function submit(payload: AccountPayload) {
    if (editing === "new") {
      createAccount.mutate(payload, {
        onSuccess: (account) => {
          toast.success(`${account.name} added.`);
          closeForm();
        },
      });
    } else if (editing) {
      updateAccount.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            toast.success("Account saved.");
            closeForm();
          },
        },
      );
    }
  }

  function archive(account: Account) {
    archiveAccount.mutate(account.id, {
      onSuccess: () => toast.success(`${account.name} archived.`),
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  function restore(account: Account) {
    restoreAccount.mutate(account.id, {
      onSuccess: () => toast.success(`${account.name} restored.`),
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const account = deleting;
    deleteAccount.mutate(account.id, {
      onSuccess: () => toast.success(`${account.name} deleted.`),
      onError: (error) => toast.error(errorMessage(error)),
      onSettled: () => setDeleting(null),
    });
  }

  const rowActions = { onEdit: setEditing, onArchive: archive, onRestore: restore, onDelete: setDeleting };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Accounts"
        title="Everything you own and owe."
        aside="Net worth is what you own minus what you owe. Track it, not just spending."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={14} weight="bold" /> Add account
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="skeleton h-56" />
          <div className="skeleton h-80" />
        </div>
      ) : (
        <>
          <Stagger className="grid gap-3 lg:grid-cols-12">
            <StaggerItem className="lg:col-span-8">
              <section className="card-muted relative h-full overflow-clip p-7 md:p-9">
                <div
                  className="dot-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]"
                  aria-hidden="true"
                />
                <p className="eyebrow relative">Net worth</p>
                <AnimatedNumber
                  value={data.totals.netWorthCents / 100}
                  format={(value) => formatCents(Math.round(value * 100))}
                  duration={0.7}
                  className="num relative mt-5 block text-[48px] font-[360] leading-none tracking-[-0.045em] sm:text-[64px] md:text-[72px]"
                />
                <p className="relative mt-4 text-[13px] text-muted">
                  You own <span className="num text-foreground">{formatCents(data.totals.assetsCents)}</span> and owe{" "}
                  <span className="num text-foreground">{formatCents(data.totals.liabilitiesCents)}</span>.
                </p>
              </section>
            </StaggerItem>
            <StaggerItem className="lg:col-span-4">
              <article className="card flex h-full flex-col justify-between gap-6 p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] text-muted">Available to spend</p>
                  {summary?.isLowBalance ? (
                    <span className="tag bg-yellow-bg text-yellow-fg">
                      <Warning size={11} weight="fill" /> Low
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="num text-[28px] leading-none tracking-[-0.03em]">{formatCents(data.totals.liquidCents)}</p>
                  <p className="mt-2 text-[12px] text-muted">Cash, bank, wallets and savings you can reach within days.</p>
                </div>
              </article>
            </StaggerItem>
          </Stagger>

          <Reveal>
            <AccountGroup
              title="What you own"
              subtitle="Assets"
              accounts={assets}
              totalCents={data.totals.assetsCents}
              {...rowActions}
            />
          </Reveal>
          <Reveal delay={0.04}>
            <AccountGroup
              title="What you owe"
              subtitle="Credit cards and loans"
              accounts={liabilities}
              totalCents={data.totals.liabilitiesCents}
              empty="No debts recorded. If you have a credit card or loan, add it so net worth tells the full story."
              {...rowActions}
            />
          </Reveal>

          <div className="flex justify-end px-1">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 accent-[var(--ds-foreground)]"
              />
              Show archived accounts
            </label>
          </div>

          {summary ? (
            <section className="space-y-4">
              <div className="px-1">
                <h2 className="text-[15px]">Savings sectors</h2>
                <p className="text-[13px] text-muted">Earmarks on your available balance.</p>
              </div>
              <SectorAllocation summary={summary} />
            </section>
          ) : null}
        </>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Add account" : "Edit account"}
        description={
          editing === "new"
            ? "A bank, wallet, savings, investment, card or loan."
            : "Changes apply to every past and future entry in this account."
        }
        onClose={closeForm}
      >
        {editing !== null ? (
          <AccountForm
            key={editing === "new" ? "new" : editing.id}
            account={editing === "new" ? undefined : editing}
            submitting={saving}
            error={formError?.message ?? null}
            onSubmit={submit}
            onCancel={closeForm}
          />
        ) : null}
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete account?"
        size="sm"
        onClose={() => {
          if (!deleteAccount.isPending) setDeleting(null);
        }}
      >
        <p className="text-[14px] leading-relaxed text-muted">
          <span className="text-foreground">{deleting?.name}</span> will be removed. Only accounts without transactions can
          be deleted; archive the others to keep their history.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <Button variant="secondary" disabled={deleteAccount.isPending} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deleteAccount.isPending} onClick={confirmDelete}>
            {deleteAccount.isPending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

type RowActions = {
  onEdit: (account: Account) => void;
  onArchive: (account: Account) => void;
  onRestore: (account: Account) => void;
  onDelete: (account: Account) => void;
};

function AccountGroup({
  title,
  subtitle,
  accounts,
  totalCents,
  empty,
  ...actions
}: RowActions & { title: string; subtitle: string; accounts: Account[]; totalCents: number; empty?: string }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-end justify-between gap-4 border-b border-line px-6 py-5 md:px-7">
        <div>
          <h2 className="text-[15px]">{title}</h2>
          <p className="text-[13px] text-muted">{subtitle}</p>
        </div>
        <p className="num text-[15px]">{formatCents(totalCents)}</p>
      </div>
      {accounts.length ? (
        <ul className="divide-y divide-line">
          {accounts.map((account, index) => (
            <AccountRow key={account.id} account={account} index={index} {...actions} />
          ))}
        </ul>
      ) : (
        <p className="px-6 py-8 text-[14px] text-muted md:px-7">{empty ?? "No accounts yet."}</p>
      )}
    </section>
  );
}

function AccountRow({ account, index, onEdit, onArchive, onRestore, onDelete }: RowActions & { account: Account; index: number }) {
  const reduceMotion = useReducedMotion();
  const meta = ACCOUNT_KINDS[account.kind];
  const archived = account.archivedAt !== null;
  const details = [
    meta.label,
    account.interestRateBps !== null ? `${account.interestRateBps / 100}% ${account.nature === "liability" ? "APR" : "yield"}` : null,
    account.creditLimitCents !== null ? `limit ${formatCents(account.creditLimitCents, 0)}` : null,
  ].filter(Boolean);

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn("group flex items-center gap-4 px-6 py-4 md:px-7", archived && "opacity-60")}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
        style={{ backgroundColor: `color-mix(in srgb, ${account.color} 14%, transparent)`, color: account.color }}
      >
        <CategoryIcon name={account.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px]">{account.name}</p>
          {account.isDefault ? <span className="tag bg-surface-3 text-muted">Default</span> : null}
          {account.isLiquid ? <span className="tag bg-green-bg text-green-fg">Available</span> : null}
          {archived ? <span className="tag bg-surface-3 text-muted">Archived</span> : null}
        </div>
        <p className="truncate text-[12px] text-muted">{details.join(" · ")}</p>
      </div>
      <Sparkline
        values={account.trend.map((point) => point.balanceCents)}
        color={account.color}
        className="hidden sm:block"
      />
      <p className="num w-32 shrink-0 text-right text-[14px]">{formatCents(account.balanceCents)}</p>
      <div className="flex shrink-0 gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <IconButton label={`Edit ${account.name}`} onClick={() => onEdit(account)}>
          <PencilSimple size={14} weight="bold" />
        </IconButton>
        {archived ? (
          <IconButton label={`Restore ${account.name}`} onClick={() => onRestore(account)}>
            <ArrowCounterClockwise size={14} weight="bold" />
          </IconButton>
        ) : !account.isDefault ? (
          <IconButton label={`Archive ${account.name}`} onClick={() => onArchive(account)}>
            <Archive size={14} weight="bold" />
          </IconButton>
        ) : null}
        {!account.isDefault ? (
          <IconButton label={`Delete ${account.name}`} onClick={() => onDelete(account)} danger>
            <Trash size={14} weight="bold" />
          </IconButton>
        ) : null}
      </div>
    </motion.li>
  );
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors",
        danger ? "hover:bg-red-bg hover:text-red-fg" : "hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
