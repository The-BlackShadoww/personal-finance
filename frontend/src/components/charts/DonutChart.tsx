"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { money } from "./core";

export type DonutSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  formatValue?: (value: number) => string;
  /** Externally controlled highlight (e.g. from a legend hover). */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  ariaLabel: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

function polar(cx: number, cy: number, r: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [round(cx + r * Math.cos(radians)), round(cy + r * Math.sin(radians))] as const;
}

function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const sweep = Math.min(end - start, 359.999);
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, outer, start);
  const [x2, y2] = polar(cx, cy, outer, start + sweep);
  const [x3, y3] = polar(cx, cy, inner, start + sweep);
  const [x4, y4] = polar(cx, cy, inner, start);
  return `M${x1},${y1}A${outer},${outer} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${inner},${inner} 0 ${large} 0 ${x4},${y4}Z`;
}

export function DonutChart({
  slices,
  size = 220,
  thickness = 22,
  centerLabel,
  formatValue = (value) => money(value),
  activeId,
  onActiveChange,
  ariaLabel,
}: DonutChartProps) {
  const reduceMotion = useReducedMotion();
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const active = activeId !== undefined ? activeId : internalActive;
  const setActive = (id: string | null) => {
    setInternalActive(id);
    onActiveChange?.(id);
  };

  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const inner = outer - thickness;
  // Angular gap that equals ~2px of surface at the mid radius.
  const gapAngle = slices.length > 1 ? (2 / ((outer + inner) / 2)) * (180 / Math.PI) : 0;

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = total ? (Math.max(0, slice.value) / total) * 360 : 0;
    const start = cursor + gapAngle / 2;
    const end = cursor + sweep - gapAngle / 2;
    cursor += sweep;
    return { slice, start, end: Math.max(start + 0.01, end) };
  });

  const activeSlice = slices.find((slice) => slice.id === active);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <motion.svg
        width={size}
        height={size}
        className="block overflow-visible"
        initial={reduceMotion ? false : { rotate: -50, scale: 0.94 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke="var(--ds-surface-2)" strokeWidth={thickness} />
        {arcs.map(({ slice, start, end }, index) => {
          const isActive = active === slice.id;
          const dimmed = active !== null && active !== undefined && !isActive;
          return (
            <motion.path
              key={slice.id}
              d={arcPath(cx, cy, isActive ? outer + 4 : outer, inner, start, end)}
              fill={slice.color}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: dimmed ? 0.3 : 1 }}
              transition={{ duration: 0.4, delay: reduceMotion || active ? 0 : index * 0.07 }}
              onPointerEnter={() => setActive(slice.id)}
              onPointerLeave={() => setActive(null)}
              className="cursor-pointer"
            />
          );
        })}
      </motion.svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSlice?.id ?? "total"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="px-8"
          >
            <p className="truncate text-[12px] text-muted">{activeSlice ? activeSlice.label : centerLabel}</p>
            <p className="num mt-0.5 text-[22px] tracking-[-0.02em] text-foreground">
              {formatValue(activeSlice ? activeSlice.value : total)}
            </p>
            {activeSlice && total ? (
              <p className="num text-[12px] text-muted">{((activeSlice.value / total) * 100).toFixed(1)}%</p>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
