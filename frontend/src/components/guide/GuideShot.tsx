"use client";

import { ArrowsOut, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type Shot = {
  /** File stem in /public/guide; `-light.webp` and `-dark.webp` variants must exist. */
  name: string;
  alt: string;
  caption: string;
  /** Path shown in the frame's address bar. */
  path: string;
  width: number;
  height: number;
  /** A dialog or a cropped section, rather than a whole page. */
  kind?: "page" | "dialog" | "crop";
};

function ThemedImage({ shot, sizes }: { shot: Shot; sizes: string }) {
  const common = { width: shot.width, height: shot.height, sizes };
  // Only one variant is displayed; lazy images that are display:none are never fetched.
  return (
    <>
      <Image
        {...common}
        src={`/guide/${shot.name}-light.webp`}
        alt={shot.alt}
        className="h-auto w-full dark:hidden"
      />
      <Image
        {...common}
        src={`/guide/${shot.name}-dark.webp`}
        alt={shot.alt}
        className="hidden h-auto w-full dark:block"
      />
    </>
  );
}

/** A screenshot in a browser-style frame. Click to see it full size. */
export function GuideShot({ shot, sizes }: { shot: Shot; sizes: string }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <figure className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge screenshot: ${shot.alt}`}
        className="group block w-full overflow-hidden rounded-[10px] border border-line bg-surface text-left shadow-[var(--ds-shadow-soft)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {shot.kind === "crop" ? null : (
          <span className="flex h-8 items-center gap-3 border-b border-line bg-surface-2 px-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-line-strong" />
              <span className="h-2 w-2 rounded-full bg-line-strong" />
              <span className="h-2 w-2 rounded-full bg-line-strong" />
            </span>
            <span className="num min-w-0 flex-1 truncate text-[11px] text-faint">
              {shot.path}
            </span>
            <ArrowsOut
              size={13}
              weight="bold"
              aria-hidden="true"
              className="text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </span>
        )}
        <span className={cn("block", shot.kind === "crop" && "p-3 sm:p-4")}>
          <ThemedImage shot={shot} sizes={sizes} />
        </span>
      </button>
      <figcaption className="mt-2.5 text-[13px] leading-relaxed text-muted">
        {shot.caption}
      </figcaption>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={shot.alt}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--ds-overlay)] p-4 backdrop-blur-[2px] sm:p-8"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              aria-label="Close screenshot"
              autoFocus
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-surface text-foreground shadow-[var(--ds-shadow-pop)] transition-colors hover:bg-surface-2"
            >
              <X size={16} weight="bold" />
            </button>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className={cn(
                "max-h-full overflow-auto rounded-[10px] border border-line bg-surface shadow-[var(--ds-shadow-pop)]",
                shot.kind === "dialog"
                  ? "w-full max-w-[520px]"
                  : "w-full max-w-[1360px]",
              )}
            >
              <ThemedImage shot={shot} sizes="100vw" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </figure>
  );
}
