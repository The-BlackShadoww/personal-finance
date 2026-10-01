"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CategoryForm, type CategoryFormSubmitValues } from "@/components/categories/CategoryForm";
import { CategoryRow } from "@/components/categories/CategoryRow";
import { PageHeader } from "@/components/layouts/PageHeader";
import { AccountSettingsTab } from "@/components/settings/AccountSettingsTab";
import { FinancialProfileTab } from "@/components/settings/FinancialProfileTab";
import { PreferencesTab } from "@/components/settings/PreferencesTab";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/lib/api/categories";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/lib/hooks/useCategories";
import { cn } from "@/lib/utils/cn";

type Tab = "profile" | "security" | "preferences" | "financial" | "categories" | "account";

const TABS: Array<{ id: Tab; label: string; description: string }> = [
  { id: "profile", label: "Profile", description: "Your name and avatar." },
  { id: "security", label: "Security", description: "Password and two-factor authentication." },
  { id: "preferences", label: "Preferences", description: "Appearance, currency and timezone." },
  { id: "financial", label: "Financial profile", description: "A few answers that tailor targets and advice to your situation." },
  { id: "categories", label: "Categories", description: "The labels you sort transactions into." },
  { id: "account", label: "Account", description: "Low-balance alert and default opening balance. Accounts and goals have their own pages." },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const { data: categoriesResponse, isLoading } = useCategories(activeTab === "categories");
  const categories = Array.isArray(categoriesResponse) ? categoriesResponse : [];
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const incomeCategories = categories.filter((category) => category.type === "income");
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const activeMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  // The active tab lives in the URL so links can target it and it survives a
  // remount (changing currency remounts the app).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    const match = TABS.find((tab) => tab.id === requested);
    if (match) setActiveTab(match.id);
  }, []);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  }

  async function handleFormSubmit(values: CategoryFormSubmitValues) {
    setError(null);
    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, data: values });
        setEditingCategory(null);
      } else {
        await createMutation.mutateAsync(values);
        setShowCreateForm(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleDeleteClick(category: Category) {
    if (deleteConfirmId === category.id) {
      try {
        await deleteMutation.mutateAsync(category.id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to delete category");
      } finally {
        setDeleteConfirmId(null);
      }
    } else {
      setDeleteConfirmId(category.id);
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Settings" title="Make it yours." aside="Profile, security, preferences, and the structure behind your numbers." />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-24 lg:self-start">
          <div
            role="tablist"
            aria-orientation="vertical"
            className="hide-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:px-0"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "relative shrink-0 rounded-[6px] px-3 py-2 text-left text-[14px] transition-colors",
                    active ? "text-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="settings-tab"
                      className="absolute inset-0 rounded-[6px] bg-surface-2"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          <AnimatePresence>
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                role="alert"
                className="flex items-start justify-between gap-3 rounded-[8px] bg-red-bg px-4 py-3 text-red-fg"
              >
                <p className="text-[14px]">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="opacity-70 transition hover:opacity-100"
                  aria-label="Dismiss settings error"
                >
                  <X size={14} weight="bold" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <section className="card overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <header className="border-b border-line px-6 py-5 md:px-8">
                  <h2 className="text-[18px] tracking-[-0.01em]">{activeMeta.label}</h2>
                  <p className="text-[13px] text-muted">{activeMeta.description}</p>
                </header>
                <div className="px-6 py-7 md:px-8 md:py-8">
                  {activeTab === "profile" && <ProfileTab />}
                  {activeTab === "security" && <SecurityTab />}
                  {activeTab === "preferences" && <PreferencesTab />}
                  {activeTab === "financial" && <FinancialProfileTab />}
                  {activeTab === "account" && <AccountSettingsTab />}
                  {activeTab === "categories" && (
                    <div className="space-y-8">
                      <AnimatePresence mode="wait" initial={false}>
                        {showCreateForm || editingCategory ? (
                          <motion.div
                            key="form"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-[10px] border border-line bg-surface-2/50 p-5 md:p-6">
                              <h3 className="mb-5 text-[15px]">
                                {editingCategory ? `Edit “${editingCategory.name}”` : "New category"}
                              </h3>
                              <CategoryForm
                                key={editingCategory?.id ?? "new"}
                                initialData={editingCategory ?? undefined}
                                onSubmit={handleFormSubmit}
                                onCancel={() => {
                                  setShowCreateForm(false);
                                  setEditingCategory(null);
                                  setError(null);
                                }}
                                isLoading={createMutation.isPending || updateMutation.isPending}
                              />
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Button onClick={() => setShowCreateForm(true)}>
                              <Plus size={14} weight="bold" />
                              New category
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {isLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="skeleton h-14" />
                          ))}
                        </div>
                      ) : null}

                      <div className="grid gap-8 xl:grid-cols-2">
                        <CategoryGroup
                          title="Income"
                          categories={incomeCategories}
                          deleteConfirmId={deleteConfirmId}
                          isDeleting={deleteMutation.isPending}
                          onEdit={(category) => {
                            setEditingCategory(category);
                            setShowCreateForm(false);
                            setDeleteConfirmId(null);
                          }}
                          onDelete={handleDeleteClick}
                          onCancelDelete={() => setDeleteConfirmId(null)}
                        />
                        <CategoryGroup
                          title="Expenses"
                          categories={expenseCategories}
                          deleteConfirmId={deleteConfirmId}
                          isDeleting={deleteMutation.isPending}
                          onEdit={(category) => {
                            setEditingCategory(category);
                            setShowCreateForm(false);
                            setDeleteConfirmId(null);
                          }}
                          onDelete={handleDeleteClick}
                          onCancelDelete={() => setDeleteConfirmId(null)}
                        />
                      </div>

                      {!isLoading && categories.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed border-line-strong px-6 py-12 text-center">
                          <p className="text-[15px]">No categories yet.</p>
                          <p className="mt-1 text-[13px] text-muted">Create your first one above.</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </div>
    </div>
  );
}

function CategoryGroup({
  title,
  categories,
  deleteConfirmId,
  isDeleting,
  onEdit,
  onDelete,
  onCancelDelete,
}: {
  title: string;
  categories: Category[];
  deleteConfirmId: string | null;
  isDeleting: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onCancelDelete: () => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 px-3 text-[13px] text-muted">
        {title}
        <span className="num text-faint">{categories.length}</span>
      </h3>
      <div className="space-y-0.5">
        {categories.map((category) => (
          <div key={category.id}>
            <CategoryRow category={category} onEdit={onEdit} onDelete={onDelete} isDeleting={isDeleting} />
            <AnimatePresence>
              {deleteConfirmId === category.id ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-3 mb-2 mt-1 flex flex-wrap items-center gap-3 rounded-[8px] bg-red-bg px-3 py-2.5 text-[13px] text-red-fg">
                    <span className="flex-1">Delete “{category.name}”? This cannot be undone.</span>
                    <button onClick={() => onDelete(category)} className="underline underline-offset-2 hover:no-underline">
                      Yes, delete
                    </button>
                    <button onClick={onCancelDelete} className="opacity-70 hover:opacity-100">
                      Cancel
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
