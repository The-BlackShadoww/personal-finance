"use client";

import { format as formatDate } from "date-fns";
import { FileText } from "@phosphor-icons/react";
import { motion } from "framer-motion";

import { AnimatedNumber } from "@/components/motion/Reveal";
import type { ReportPreviewData } from "@/lib/hooks/useReportPreview";

function formatDollar(amount: number): string {
  const abs = Math.abs(amount);
  return `$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ReportPreviewCardProps {
  preview: ReportPreviewData | undefined;
  isLoading: boolean;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  format?: "csv" | "pdf";
}

export function ReportPreviewCard({
  preview,
  isLoading,
  startYear,
  startMonth,
  endYear,
  endMonth,
  format = "csv",
}: ReportPreviewCardProps) {
  if (!startYear || !startMonth || !endYear || !endMonth) {
    return (
      <div className="card relative flex flex-col items-center justify-center overflow-clip px-8 py-16 text-center">
        <div className="dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden="true" />
        <div className="relative mb-4 grid h-11 w-11 place-items-center rounded-[10px] border border-line bg-surface">
          <FileText size={18} weight="bold" className="text-muted" />
        </div>
        <p className="relative text-[15px]">Preview will appear here</p>
        <p className="relative mt-1 max-w-[220px] text-[13px] text-muted">
          Pick a valid date range to see a summary before downloading.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card space-y-5 p-7">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-2 w-full" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-4" />
          ))}
        </div>
      </div>
    );
  }

  if (preview) {
    const startLabel = formatDate(new Date(startYear, startMonth - 1, 1), "MMM yyyy");
    const endLabel = formatDate(new Date(endYear, endMonth - 1, 1), "MMM yyyy");
    const periodLabel = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
    const flow = Math.max(1, preview.totalIncome + preview.totalExpense);

    const rows = [
      { label: "Income", value: formatDollar(preview.totalIncome), dot: "var(--ds-series-income)" },
      { label: "Expenses", value: formatDollar(preview.totalExpense), dot: "var(--ds-series-expense)" },
      {
        label: "Net savings",
        value: `${preview.savings < 0 ? "−" : ""}${formatDollar(preview.savings)}`,
        dot: "var(--ds-series-net)",
      },
      { label: "Transactions", value: preview.transactionCount.toLocaleString() },
      {
        label: "Months included",
        value: `${preview.monthsIncluded} mo${preview.monthsIncluded !== 1 ? "s" : ""}`,
      },
    ];

    return (
      <div className="card relative overflow-clip">
        {/* Faux document header */}
        <div className="flex items-center gap-1.5 border-b border-line bg-surface-2/60 px-5 py-3" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 truncate font-mono text-[11px] text-muted">
            report_{startYear}-{String(startMonth).padStart(2, "0")}_to_{endYear}-{String(endMonth).padStart(2, "0")}.{format}
          </span>
        </div>

        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Report preview</p>
              <p className="mt-1 text-[15px]">{periodLabel}</p>
            </div>
            <span className="tag bg-surface-2 text-muted">{format}</span>
          </div>

          <div className="mt-7">
            <p className="text-[13px] text-muted">Net savings</p>
            <AnimatedNumber
              value={preview.savings}
              format={(v) => `${v < 0 ? "−" : ""}${formatDollar(v)}`}
              className="num mt-1 block text-[40px] font-[360] leading-none tracking-[-0.04em]"
            />
          </div>

          <div className="mt-6 flex h-2 gap-[2px] overflow-hidden rounded-[3px]" aria-hidden="true">
            <motion.span
              className="h-full rounded-l-[3px] bg-income"
              initial={{ width: 0 }}
              animate={{ width: `${(preview.totalIncome / flow) * 100}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.span
              className="h-full rounded-r-[3px] bg-expense"
              initial={{ width: 0 }}
              animate={{ width: `${(preview.totalExpense / flow) * 100}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            />
          </div>

          <dl className="mt-6 divide-y divide-dashed divide-line-strong">
            {rows.map((row, index) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="flex items-center justify-between py-2.5 text-[14px]"
              >
                <dt className="flex items-center gap-2 text-muted">
                  {row.dot ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.dot }} /> : null}
                  {row.label}
                </dt>
                <dd className="num text-foreground">{row.value}</dd>
              </motion.div>
            ))}
          </dl>

          <p className="mt-5 text-[12px] leading-relaxed text-muted">
            Your download will include all {preview.transactionCount.toLocaleString()} transaction
            {preview.transactionCount !== 1 ? "s" : ""} from this period.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-7 text-center">
      <p className="text-[15px]">No data for this period.</p>
      <p className="mt-1 text-[13px] text-muted">Try widening your date range.</p>
    </div>
  );
}
