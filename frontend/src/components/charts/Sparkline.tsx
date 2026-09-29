"use client";

import { motion, useReducedMotion } from "framer-motion";
import { smoothPath } from "./core";

export function Sparkline({
  values,
  color = "var(--ds-foreground)",
  width = 96,
  height = 32,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;
  const points = values.map(
    (value, i) =>
      [
        pad + (i / (values.length - 1)) * (width - pad * 2),
        pad + (height - pad * 2) - ((value - min) / range) * (height - pad * 2),
      ] as [number, number],
  );
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} className={className} aria-hidden="true" overflow="visible">
      <motion.path
        d={smoothPath(points)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r={3}
        fill={color}
        stroke="var(--ds-surface)"
        strokeWidth={1.5}
        initial={reduceMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 500, damping: 20 }}
      />
    </svg>
  );
}
