"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/lib/hooks/useTheme";
import { cn } from "@/lib/utils/cn";

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        "relative inline-flex h-9 items-center gap-2.5 overflow-clip rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
        withLabel ? "px-3 text-[14px]" : "w-9 justify-center",
        className,
      )}
    >
      <span className="relative grid h-4 w-4 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="absolute inset-0 grid place-items-center"
          >
            {theme === "dark" ? <Moon size={16} weight="bold" /> : <Sun size={16} weight="bold" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {withLabel ? <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span> : null}
    </button>
  );
}
