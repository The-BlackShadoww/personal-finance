"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT_EXPO } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

const FLOWS = [
  {
    id: "track",
    title: "Record every entry",
    body: "Log income and expenses with a category, a note, and the month it belongs to — even if the money moved on a different day.",
    image: "https://picsum.photos/seed/still-lake/1600/900",
    card: { label: "Groceries · Sep 2026", value: "-$84.20", meta: "Counted in September" },
  },
  {
    id: "understand",
    title: "Read the month at a glance",
    body: "Income, spending, and savings rate for any month, quarter, or year, with the categories that shaped them.",
    image: "https://picsum.photos/seed/dune-light/1600/900",
    card: { label: "Savings rate", value: "38.4%", meta: "+4.1 pts vs August" },
  },
  {
    id: "allocate",
    title: "Give savings a place",
    body: "Set money aside for an emergency fund or a trip the moment income arrives, and see exactly what is left to spend.",
    image: "https://picsum.photos/seed/forest-path/1600/900",
    card: { label: "Emergency fund", value: "$6,400", meta: "64% of $10,000 goal" },
  },
  {
    id: "export",
    title: "Take the numbers with you",
    body: "Download CSV or PDF reports for any date range when you plan, share, or file your taxes.",
    image: "https://picsum.photos/seed/paper-desk/1600/900",
    card: { label: "Q3 2026 report", value: "PDF", meta: "214 transactions" },
  },
];

const DURATION = 6000;

export function FlowTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15%" });
  const reduceMotion = useReducedMotion();
  const running = inView && !paused && !reduceMotion;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % FLOWS.length), DURATION);
    return () => window.clearTimeout(timer);
  }, [active, running]);

  const flow = FLOWS[active];

  return (
    <div ref={ref} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="grain relative aspect-[4/3] overflow-clip rounded-[12px] bg-surface-2 sm:aspect-[16/9] lg:aspect-[21/9]">
        <AnimatePresence initial={false}>
          <motion.img
            key={flow.id}
            src={flow.image}
            alt=""
            className="photo absolute inset-0 h-full w-full object-cover"
            initial={reduceMotion ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: EASE_OUT_EXPO }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={flow.id}
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.15 }}
              className="w-[280px] rounded-[12px] border border-white/40 bg-white/85 p-5 text-[#161514] shadow-[0_24px_60px_rgb(0_0_0/0.18)] backdrop-blur-xl"
            >
              <p className="text-[12px] text-[#71706f]">{flow.card.label}</p>
              <p className="num mt-2 text-[34px] font-[360] leading-none tracking-[-0.04em]">{flow.card.value}</p>
              <p className="mt-4 border-t border-[#eaeaea] pt-3 text-[12px] text-[#71706f]">{flow.card.meta}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Product flows">
        {FLOWS.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(index)}
              className="group text-left"
            >
              <span className="relative block h-px w-full overflow-clip bg-line">
                {selected ? (
                  <motion.span
                    key={`${item.id}-${active}-${running}`}
                    className="absolute inset-y-0 left-0 block w-full bg-foreground"
                    style={{ originX: 0 }}
                    initial={{ scaleX: running ? 0 : 1 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: running ? DURATION / 1000 : 0, ease: "linear" }}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-4 block text-[15px] transition-colors duration-300",
                  selected ? "text-foreground" : "text-ghost group-hover:text-muted",
                )}
              >
                {item.title}
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: selected ? 1 : 0.0, height: selected ? "auto" : 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                className="block overflow-hidden text-[14px] leading-relaxed text-muted lg:!h-auto lg:!opacity-100"
              >
                <span className={cn("block pt-2 transition-opacity duration-300", !selected && "lg:opacity-40")}>{item.body}</span>
              </motion.span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
