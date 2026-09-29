"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_OUT_EXPO } from "@/components/motion/Reveal";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  /** Muted continuation of the title, natural.com two-tone style. */
  aside?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, aside, description, actions }: PageHeaderProps) {
  const reduceMotion = useReducedMotion();
  return (
    <header className="flex flex-col gap-6 pb-2 md:flex-row md:items-end md:justify-between">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
        className="max-w-3xl"
      >
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h1 className="text-[32px] font-[380] leading-[1.1] tracking-[-0.025em] text-foreground md:text-[40px]">
          {title}
          {aside ? <span className="text-ghost"> {aside}</span> : null}
        </h1>
        {description ? <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </motion.div>
      {actions ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.08 }}
          className="flex flex-wrap items-center gap-2"
        >
          {actions}
        </motion.div>
      ) : null}
    </header>
  );
}
