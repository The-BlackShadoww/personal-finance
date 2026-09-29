"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Notice({
  show,
  tone,
  children,
}: {
  show: boolean;
  tone: "success" | "error" | "warning";
  children: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle : WarningCircle;
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            role={tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-start gap-2.5 rounded-[8px] px-3.5 py-3 text-[13px]",
              tone === "success" && "bg-green-bg text-green-fg",
              tone === "error" && "bg-red-bg text-red-fg",
              tone === "warning" && "bg-yellow-bg text-yellow-fg",
            )}
          >
            <Icon size={15} weight="fill" className="mt-px shrink-0" />
            <div>{children}</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-[12px] text-red-fg">{message}</p> : null;
}

export function SectionTitle({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[15px] text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 max-w-lg text-[13px] text-muted">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}
