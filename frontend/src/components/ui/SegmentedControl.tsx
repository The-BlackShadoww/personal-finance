"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Option<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
  fullWidth = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  label: string;
  size?: "sm" | "md";
  className?: string;
  fullWidth?: boolean;
}) {
  const id = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "hide-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[8px] bg-surface-2 p-[3px]",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 rounded-[6px] font-normal transition-colors duration-200 disabled:opacity-35",
              size === "sm" ? "h-7 px-3 text-[13px]" : "h-8 px-3.5 text-[14px]",
              fullWidth && "flex-1",
              active ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[6px] border border-line bg-surface shadow-[0_1px_2px_rgb(22_21_20/0.05)] dark:bg-surface-3"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 36 }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
