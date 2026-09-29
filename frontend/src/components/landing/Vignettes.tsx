"use client";

import { FileCsv, FilePdf, ShoppingCart, Briefcase, Coffee, House, Check } from "@phosphor-icons/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Gauge } from "@/components/charts/Gauge";

const FEED = [
  { icon: Briefcase, name: "Salary", note: "September payroll", amount: "+$6,200.00", tone: "#1baf7a" },
  { icon: House, name: "Housing", note: "Rent", amount: "-$1,650.00", tone: "#2a78d6" },
  { icon: ShoppingCart, name: "Groceries", note: "Weekly shop", amount: "-$84.20", tone: "#eb6834" },
  { icon: Coffee, name: "Dining out", note: "Lunch with Sam", amount: "-$18.50", tone: "#eda100" },
];

/** A ledger that fills itself line by line. */
export function FeedVignette() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(reduceMotion ? FEED.length : 1);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const timer = window.setInterval(() => {
      setCount((current) => (current >= FEED.length ? 1 : current + 1));
    }, 1600);
    return () => window.clearInterval(timer);
  }, [inView, reduceMotion]);

  return (
    <div ref={ref} className="flex h-full flex-col justify-start gap-1.5 p-5">
      <AnimatePresence initial={false}>
        {FEED.slice(0, count).map((item) => (
          <motion.div
            key={item.name}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex items-center gap-3 rounded-[8px] border border-line bg-surface px-3 py-2"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-[6px]"
              style={{ backgroundColor: `color-mix(in srgb, ${item.tone} 14%, transparent)`, color: item.tone }}
            >
              <item.icon size={13} weight="bold" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px]">{item.name}</span>
              <span className="block truncate text-[11px] text-muted">{item.note}</span>
            </span>
            <span className="num text-[12px]">{item.amount}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function GaugeVignette() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  return (
    <div ref={ref} className="flex h-full items-end justify-center pb-6">
      {inView ? <Gauge value={38.4} size={220} label="Savings rate, September" /> : null}
    </div>
  );
}

/** A report file that renders, then downloads. */
export function ReportVignette() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % 3), 1800);
    return () => window.clearInterval(timer);
  }, [inView, reduceMotion]);

  return (
    <div ref={ref} className="flex h-full items-center justify-center gap-3 p-5">
      {[FileCsv, FilePdf].map((Icon, index) => (
        <motion.div
          key={index}
          animate={{ y: step === index + 1 ? -6 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative w-[112px] rounded-[8px] border border-line bg-surface p-3"
        >
          <div className="flex items-center justify-between">
            <Icon size={18} weight="bold" className="text-muted" />
            <AnimatePresence>
              {step === index + 1 ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="grid h-4 w-4 place-items-center rounded-full bg-green-bg text-green-fg"
                >
                  <Check size={9} weight="bold" />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="mt-4 space-y-1.5">
            <span className="block h-1 w-full rounded-full bg-surface-3" />
            <span className="block h-1 w-4/5 rounded-full bg-surface-3" />
            <span className="block h-1 w-3/5 rounded-full bg-surface-3" />
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              className="block h-full rounded-full bg-foreground"
              style={{ originX: 0 }}
              animate={{ scaleX: step >= index + 1 ? 1 : 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted">{index === 0 ? "q3_2026.csv" : "q3_2026.pdf"}</p>
        </motion.div>
      ))}
    </div>
  );
}
