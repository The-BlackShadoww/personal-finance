"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowClockwise, Clock, FileCsv, FilePdf, Trash } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

import type { DownloadHistoryEntry } from "@/lib/hooks/useDownloadHistory";

interface DownloadHistoryListProps {
  history: DownloadHistoryEntry[];
  onRedownload: (entry: DownloadHistoryEntry) => void;
  onClear: () => void;
  isDownloading: boolean;
}

export function DownloadHistoryList({ history, onRedownload, onClear, isDownloading }: DownloadHistoryListProps) {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px]">Download history</h2>
          <p className="text-[13px] text-muted">Stored on this device only.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[13px] text-muted transition-colors hover:bg-red-bg hover:text-red-fg"
            title="Clear download history"
          >
            <Trash size={13} weight="bold" />
            Clear
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[8px] bg-surface-2 px-4 py-4 text-[13px] text-muted">
          <Clock size={15} weight="bold" />
          <span>No reports downloaded yet. Your history will appear here.</span>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          <AnimatePresence initial={false}>
            {history.map((entry) => {
              const startLabel = format(new Date(entry.startYear, entry.startMonth - 1, 1), "MMM yyyy");
              const endLabel = format(new Date(entry.endYear, entry.endMonth - 1, 1), "MMM yyyy");
              const rangeLabel =
                entry.startYear === entry.endYear && entry.startMonth === entry.endMonth
                  ? startLabel
                  : `${startLabel} – ${endLabel}`;
              const timeAgo = formatDistanceToNow(parseISO(entry.downloadedAt), { addSuffix: true });
              const FormatIcon = entry.format === "csv" ? FileCsv : FilePdf;

              return (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group overflow-hidden"
                >
                  <div className="flex items-center gap-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-muted">
                      <FormatIcon size={16} weight="bold" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px]">{rangeLabel}</p>
                      <p className="text-[12px] text-muted">
                        <span className="font-mono uppercase">{entry.format}</span>
                        <span className="mx-1.5 text-ghost">·</span>
                        {timeAgo}
                      </p>
                    </div>
                    <button
                      onClick={() => onRedownload(entry)}
                      disabled={isDownloading}
                      className="flex shrink-0 items-center gap-1.5 rounded-[6px] border border-line px-2.5 py-1.5 text-[12px] text-muted transition-all hover:border-line-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      title={`Re-download ${entry.filename}`}
                    >
                      <ArrowClockwise size={12} weight="bold" />
                      Download again
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {history.length > 0 && (
        <p className="num mt-4 text-[12px] text-muted">
          {history.length} download{history.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
