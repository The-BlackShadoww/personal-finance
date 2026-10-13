"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

type Placement = { top?: number; bottom?: number; left: number; minWidth: number; maxHeight: number; above: boolean };

const GAP = 6;
const EDGE = 12;

// A floating panel anchored to a trigger. It is portalled to <body> so it is
// never clipped by a Modal's overflow, and sits above the modal layer (z-70).
export function Popover({
  anchorRef,
  open,
  onClose,
  children,
  className,
  matchWidth = true,
  preferredHeight = 320,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  matchWidth?: boolean;
  preferredHeight?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const below = viewportHeight - rect.bottom - GAP - EDGE;
    const aboveSpace = rect.top - GAP - EDGE;
    const above = below < Math.min(preferredHeight, 220) && aboveSpace > below;
    const panelWidth = Math.max(panel?.offsetWidth ?? 0, matchWidth ? rect.width : 0);
    const left = Math.max(EDGE, Math.min(rect.left, viewportWidth - panelWidth - EDGE));
    setPlacement({
      ...(above ? { bottom: viewportHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      left,
      minWidth: matchWidth ? rect.width : 0,
      maxHeight: Math.max(160, Math.min(preferredHeight, above ? aboveSpace : below)),
      above,
    });
  }, [anchorRef, matchWidth, panel, preferredHeight]);

  useLayoutEffect(() => {
    if (open) place();
    else setPlacement(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: PointerEvent) {
      const target = event.target as Node;
      if (panel?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", handlePointer, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", handlePointer, true);
    };
  }, [open, place, onClose, panel, anchorRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && placement ? (
        <motion.div
          ref={setPanel}
          className={cn(
            "fixed z-[90] flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface shadow-[var(--ds-shadow-pop)] dark:border-line-strong dark:bg-surface-2",
            className,
          )}
          style={{
            top: placement.top,
            bottom: placement.bottom,
            left: placement.left,
            minWidth: placement.minWidth,
            maxHeight: placement.maxHeight,
            maxWidth: `calc(100vw - ${EDGE * 2}px)`,
          }}
          initial={reduceMotion ? false : { opacity: 0, y: placement.above ? 4 : -4, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: placement.above ? 4 : -4, scale: 0.985 }}
          transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
