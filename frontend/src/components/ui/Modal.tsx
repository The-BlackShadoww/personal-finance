"use client";

import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md";
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Modal({ open, title, description, children, onClose, size = "md" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      getFocusableElements(panelRef.current)[0]?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--ds-overlay)] backdrop-blur-[2px] sm:items-center sm:p-6"
          onMouseDown={handleBackdropClick}
          onKeyDown={handleKeyDown}
          role="presentation"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            ref={panelRef}
            className={cn(
              "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[16px] border border-line bg-surface shadow-[var(--ds-shadow-pop)] sm:max-h-[calc(100vh-3rem)] sm:rounded-[12px]",
              size === "sm" ? "sm:max-w-md" : "sm:max-w-xl",
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.985 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.8 }
            }
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5 sm:px-7 sm:pt-6">
              <div>
                <h2 id={titleId} className="text-[20px] font-normal tracking-[-0.02em] text-foreground">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                className="-mr-2 -mt-1 grid h-9 w-9 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                onClick={onClose}
              >
                <X size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6 pt-3 sm:px-7 sm:pb-7">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null,
  );
}
