"use client";

import { ArrowUpRight, Plus, Target } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";

const PREVIEW = [
  { name: "Housing", planned: 1400, spent: 1400, color: "var(--ds-series-net)" },
  { name: "Groceries", planned: 520, spent: 364, color: "var(--ds-series-income)" },
  { name: "Transport", planned: 180, spent: 151, color: "var(--ds-series-expense)" },
];

export default function BudgetsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Budgets"
        title="Give every dollar a direction."
        aside="Build a spending plan around what you want your money to make possible."
        actions={
          <Button>
            <Target size={14} weight="bold" />
            Create a budget
          </Button>
        }
      />

      <Stagger className="grid gap-3 lg:grid-cols-12">
        <StaggerItem className="lg:col-span-7">
          <article className="card-muted relative h-full overflow-clip p-7 md:p-9">
            <div className="dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_bottom_right,black,transparent_65%)]" aria-hidden="true" />
            <div className="relative">
              <span className="tag bg-surface text-muted">This month</span>
              <h2 className="mt-6 max-w-md text-[28px] font-[380] leading-[1.15] tracking-[-0.025em]">
                Start with what matters,
                <span className="text-ghost"> then make room for the rest.</span>
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-muted">
                A budget is your plan for the money you have — not a judgment about the money you spend.
              </p>
              <div className="mt-10 grid grid-cols-2 gap-6 border-t border-line-strong/70 pt-6">
                <div>
                  <p className="text-[13px] text-muted">Planned</p>
                  <p className="num mt-1 text-[26px] tracking-[-0.02em]">$0.00</p>
                </div>
                <div>
                  <p className="text-[13px] text-muted">Remaining</p>
                  <p className="num mt-1 text-[26px] tracking-[-0.02em]">$0.00</p>
                </div>
              </div>
            </div>
          </article>
        </StaggerItem>

        <StaggerItem className="lg:col-span-5">
          <article className="card flex h-full flex-col justify-between p-7 md:p-9">
            <div>
              <p className="eyebrow">What it will look like</p>
              <ul className="mt-6 space-y-5" aria-hidden="true">
                {PREVIEW.map((item, index) => (
                  <li key={item.name}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="num text-muted">
                        ${item.spent} <span className="text-faint">/ ${item.planned}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color, originX: 0 }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: item.spent / item.planned }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 + index * 0.12 }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-10">
              <h2 className="text-[18px] tracking-[-0.01em]">Your first budget is one good decision away.</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                Choose a category, set an amount, and you’ll have a clear signal every time you spend.
              </p>
              <Button variant="secondary" className="mt-6">
                <Plus size={14} weight="bold" />
                Set up your first budget
              </Button>
            </div>
          </article>
        </StaggerItem>
      </Stagger>

      <Reveal>
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
            <div>
              <h2 className="text-[15px]">Budget categories</h2>
              <p className="text-[13px] text-muted">Your planned spending will appear here.</p>
            </div>
            <span className="tag w-fit bg-surface-2 text-muted">No active budgets</span>
          </div>
          <div className="grid place-items-center px-6 py-20 text-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="grid h-12 w-12 place-items-center rounded-[10px] border border-line bg-surface-2"
            >
              <Target size={18} weight="bold" />
            </motion.div>
            <h3 className="mt-5 text-[18px] tracking-[-0.01em]">Create a plan you can actually use.</h3>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
              Start with a single category. You can add more as your plan takes shape.
            </p>
            <button className="mt-6 inline-flex items-center gap-1.5 text-[14px] text-foreground underline-offset-4 hover:underline">
              Create a budget <ArrowUpRight size={13} weight="bold" />
            </button>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
