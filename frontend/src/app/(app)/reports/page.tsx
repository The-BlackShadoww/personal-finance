"use client";

import { DownloadSimple, FileCsv, FilePdf, WarningCircle, X } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { DownloadHistoryList } from "@/components/reports/DownloadHistoryList";
import { ReportPreviewCard } from "@/components/reports/ReportPreviewCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { reportsApi } from "@/lib/api/reports";
import { type DownloadHistoryEntry, useDownloadHistory } from "@/lib/hooks/useDownloadHistory";
import { useReportPreview } from "@/lib/hooks/useReportPreview";
import { cn } from "@/lib/utils/cn";
import { Select } from "@/components/ui/Select";

type ReportFormat = "csv" | "pdf";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

const FORMAT_OPTIONS: Array<{ value: ReportFormat; Icon: typeof FilePdf; label: string; description: string }> = [
  { value: "csv", Icon: FileCsv, label: "CSV", description: "Spreadsheet-ready data" },
  { value: "pdf", Icon: FilePdf, label: "PDF", description: "Formatted for sharing" },
];

export default function ReportsPage() {
  const today = new Date();
  const [startMonth, setStartMonth] = useState(today.getMonth() + 1);
  const [startYear, setStartYear] = useState(today.getFullYear());
  const [endMonth, setEndMonth] = useState(today.getMonth() + 1);
  const [endYear, setEndYear] = useState(today.getFullYear());
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const dateRangeError =
    endYear < startYear || (endYear === startYear && endMonth < startMonth)
      ? "End period cannot be before start period."
      : null;

  const { data: preview, isLoading: isPreviewLoading } = useReportPreview(
    dateRangeError ? null : startYear,
    dateRangeError ? null : startMonth,
    dateRangeError ? null : endYear,
    dateRangeError ? null : endMonth,
  );

  const { history, addEntry, clearHistory } = useDownloadHistory();

  const download = useCallback(
    async (
      params: { startYear: number; startMonth: number; endYear: number; endMonth: number },
      reportFormat: ReportFormat,
    ) => {
      setIsDownloading(true);
      setDownloadError(null);
      let objectUrl: string | null = null;
      try {
        const blob =
          reportFormat === "csv" ? await reportsApi.downloadCsv(params) : await reportsApi.downloadPdf(params);
        objectUrl = URL.createObjectURL(blob);
        const filename = `report_${params.startYear}-${String(params.startMonth).padStart(2, "0")}_to_${params.endYear}-${String(params.endMonth).padStart(2, "0")}.${reportFormat}`;
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        addEntry({
          id: crypto.randomUUID(),
          format: reportFormat,
          ...params,
          downloadedAt: new Date().toISOString(),
          filename,
        });
      } catch (error) {
        setDownloadError(error instanceof Error ? error.message : "Download failed. Please try again.");
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setIsDownloading(false);
      }
    },
    [addEntry],
  );

  const params = { startYear, startMonth, endYear, endMonth };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Reports"
        title="Take your numbers with you."
        aside="Export any period as a spreadsheet or a shareable PDF."
      />

      <div className="grid gap-3 lg:grid-cols-12">
        <Reveal className="space-y-3 lg:col-span-7">
          <section className="card p-6 md:p-7">
            <h2 className="text-[15px]">Period</h2>
            <p className="text-[13px] text-muted">Choose the months to include.</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              {(
                [
                  ["From", startMonth, setStartMonth, startYear, setStartYear],
                  null,
                  ["To", endMonth, setEndMonth, endYear, setEndYear],
                ] as const
              ).map((entry, index) =>
                entry === null ? (
                  <span key={index} className="hidden pb-3 text-center text-muted sm:block" aria-hidden="true">
                    →
                  </span>
                ) : (
                  <div key={entry[0]}>
                    <p className="label text-muted">{entry[0]}</p>
                    <div className="flex gap-2">
                      <Select
                        aria-label={`${entry[0]} month`}
                        value={entry[1]}
                        onChange={(e) => entry[2](Number(e.target.value))}
                        className="field flex-1"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={name} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        aria-label={`${entry[0]} year`}
                        value={entry[3]}
                        onChange={(e) => entry[4](Number(e.target.value))}
                        className="field w-[96px]"
                      >
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ),
              )}
            </div>

            <AnimatePresence>
              {dateRangeError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <span className="mt-4 flex items-center gap-2 rounded-[6px] bg-red-bg px-3 py-2 text-[13px] text-red-fg">
                    <WarningCircle size={14} weight="fill" />
                    {dateRangeError}
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          <section className="card p-6 md:p-7">
            <h2 className="text-[15px]">Format</h2>
            <p className="text-[13px] text-muted">Pick how you want the file.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Report format">
              {FORMAT_OPTIONS.map(({ value, Icon, label, description }) => {
                const selected = format === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormat(value)}
                    className={cn(
                      "relative flex items-center gap-4 rounded-[10px] border p-4 text-left transition-colors duration-200",
                      selected ? "border-foreground" : "border-line hover:border-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-[8px] transition-colors",
                        selected ? "bg-strong text-strong-foreground" : "bg-surface-2 text-muted",
                      )}
                    >
                      <Icon size={18} weight="bold" />
                    </span>
                    <span>
                      <span className="block text-[14px]">{label}</span>
                      <span className="block text-[12px] text-muted">{description}</span>
                    </span>
                    <span
                      className={cn(
                        "ml-auto grid h-4 w-4 place-items-center rounded-full border transition-colors",
                        selected ? "border-foreground" : "border-line-strong",
                      )}
                      aria-hidden="true"
                    >
                      {selected ? (
                        <motion.span
                          layoutId="format-dot"
                          className="h-2 w-2 rounded-full bg-foreground"
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <Button
            size="lg"
            onClick={() => !dateRangeError && download(params, format)}
            disabled={Boolean(dateRangeError || isDownloading)}
            className="w-full"
          >
            {isDownloading ? <Spinner /> : <DownloadSimple size={16} weight="bold" />}
            {isDownloading ? "Generating…" : `Download ${format.toUpperCase()} report`}
          </Button>

          <AnimatePresence>
            {downloadError && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                role="alert"
                className="flex items-start justify-between gap-3 rounded-[8px] bg-red-bg p-4 text-[14px] text-red-fg"
              >
                <p>{downloadError}</p>
                <button
                  onClick={() => setDownloadError(null)}
                  className="mt-0.5 shrink-0 opacity-70 transition-opacity hover:opacity-100"
                  aria-label="Dismiss"
                >
                  <X size={14} weight="bold" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>

        <Reveal className="lg:col-span-5 lg:self-start lg:sticky lg:top-24" delay={0.08}>
          <ReportPreviewCard preview={preview} isLoading={isPreviewLoading} format={format} {...params} />
        </Reveal>
      </div>

      <Reveal>
        <section className="card p-6 md:p-7">
          <DownloadHistoryList
            history={history}
            onRedownload={(entry: DownloadHistoryEntry) => download(entry, entry.format)}
            onClear={clearHistory}
            isDownloading={isDownloading}
          />
        </section>
      </Reveal>
    </div>
  );
}
