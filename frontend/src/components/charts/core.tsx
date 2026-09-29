"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Series = {
  key: string;
  label: string;
  /** CSS color, typically a var(--ds-series-*) token. */
  color: string;
};

export type Datum = {
  label: string;
  /** Optional long label for tooltips, e.g. "March 2026". */
  title?: string;
  values: Record<string, number>;
};

/** Observes an element's content box. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize((current) =>
        Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

/** Rounds a max value up to a clean axis bound and returns evenly spaced ticks. */
export function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const rawStep = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  const step = niceResidual * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return { min: niceMin, max: niceMax, ticks };
}

/** Monotone cubic interpolation (Fritsch–Carlson) — smooth without overshoot. */
const r2 = (value: number) => Math.round(value * 100) / 100;

export function smoothPath(input: Array<[number, number]>) {
  // Rounded so server and client render byte-identical paths.
  const points = input.map(([px, py]) => [r2(px), r2(py)] as [number, number]);
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  if (n === 2) return `M${points[0][0]},${points[0][1]}L${points[1][0]},${points[1][1]}`;

  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    slopes.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1));
  }
  const tangents: number[] = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents.push(0);
    } else {
      const common = dx[i - 1] + dx[i];
      tangents.push((3 * common) / ((common + dx[i]) / slopes[i - 1] + (common + dx[i - 1]) / slopes[i]));
    }
  }
  tangents.push(slopes[n - 2]);

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = dx[i] / 3;
    d += `C${r2(x0 + h)},${r2(y0 + tangents[i] * h)} ${r2(x1 - h)},${r2(y1 - tangents[i + 1] * h)} ${x1},${y1}`;
  }
  return d;
}

export function compactMoney(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${trim(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function trim(value: number) {
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, "");
}

export function money(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/* ------------------------------------------------------------------ */

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-2 text-[13px] text-muted">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function TooltipCard({
  visible,
  x,
  y,
  containerWidth,
  children,
}: {
  visible: boolean;
  x: number;
  y: number;
  containerWidth: number;
  children: ReactNode;
}) {
  const width = 188;
  const flip = x + width + 20 > containerWidth;
  const left = flip ? Math.max(0, x - width - 14) : x + 14;
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, x: left, y }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 600, damping: 42, mass: 0.6 }}
          className="pointer-events-none absolute left-0 top-0 z-20 rounded-[10px] border border-line bg-surface/95 px-3.5 py-3 text-[13px] shadow-[var(--ds-shadow-pop)] backdrop-blur-md"
          style={{ width }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex items-center gap-2 text-muted">
        {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
        {label}
      </span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}

export function ChartEmpty({ height, message, children }: { height: number; message: string; children?: ReactNode }) {
  return (
    <div
      className="dot-grid flex flex-col items-center justify-center gap-3 rounded-[8px] px-6 text-center"
      style={{ height }}
    >
      <p className="max-w-[240px] rounded-[6px] bg-surface px-3 py-1.5 text-[13px] text-muted">{message}</p>
      {children}
    </div>
  );
}
