"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/motion/Reveal";

/** Semi-circular meter for a 0–100 percentage (values outside are clamped for the arc). */
export function Gauge({
  value,
  size = 240,
  label,
  color = "var(--ds-series-net)",
}: {
  value: number;
  size?: number;
  label: string;
  color?: string;
}) {
  const reduceMotion = useReducedMotion();
  const stroke = 14;
  const radius = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(100, value));
  const arc = `M${cx - radius},${cy} A${radius},${radius} 0 0 1 ${cx + radius},${cy}`;
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size / 2 + 28 }}>
      <svg width={size} height={size / 2 + 8} className="block overflow-visible" role="img" aria-label={`${label}: ${value.toFixed(1)}%`}>
        {ticks.map((tick) => {
          const angle = Math.PI - (tick / 100) * Math.PI;
          const r1 = radius + stroke / 2 + 5;
          const r2 = r1 + (tick % 25 === 0 ? 6 : 3);
          return (
            <line
              key={tick}
              x1={Math.round((cx + r1 * Math.cos(angle)) * 100) / 100}
              y1={Math.round((cy - r1 * Math.sin(angle)) * 100) / 100}
              x2={Math.round((cx + r2 * Math.cos(angle)) * 100) / 100}
              y2={Math.round((cy - r2 * Math.sin(angle)) * 100) / 100}
              stroke={tick <= clamped ? "var(--ds-muted)" : "var(--ds-line-strong)"}
              strokeWidth={1}
            />
          );
        })}
        <path d={arc} fill="none" stroke="var(--ds-surface-2)" strokeWidth={stroke} strokeLinecap="round" />
        <motion.path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: clamped / 100 || 0.0001 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <AnimatedNumber
          value={value}
          format={(v) => `${v.toFixed(1)}%`}
          className="num text-[34px] leading-none tracking-[-0.03em] text-foreground"
        />
        <span className="mt-1.5 text-[12px] text-muted">{label}</span>
      </div>
    </div>
  );
}
