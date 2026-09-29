"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  TooltipCard,
  TooltipRow,
  compactMoney,
  money,
  niceTicks,
  smoothPath,
  useElementSize,
  type Datum,
  type Series,
} from "./core";

type BarChartProps = {
  data: Datum[];
  /** Series drawn as grouped columns. */
  series: Series[];
  /** Optional series drawn as a line over the columns (same unit, same axis). */
  line?: Series;
  height?: number;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  ariaLabel: string;
  maxBarWidth?: number;
  /** Colors each bar per sign instead of per series (single-series polarity charts). */
  negativeColor?: string;
};

const PAD = { top: 14, right: 8, bottom: 28, left: 48 };

export function BarChart({
  data,
  series,
  line,
  height = 280,
  formatValue = (value) => money(value),
  formatTick = compactMoney,
  ariaLabel,
  maxBarWidth = 22,
  negativeColor,
}: BarChartProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = height - PAD.top - PAD.bottom;

  const scale = useMemo(() => {
    const keys = [...series.map((s) => s.key), ...(line ? [line.key] : [])];
    const all = data.flatMap((d) => keys.map((k) => d.values[k] ?? 0));
    return niceTicks(Math.min(0, ...all), Math.max(1, ...all), 4);
  }, [data, line, series]);

  const band = data.length ? innerWidth / data.length : 0;
  const gap = 2;
  const barWidth = Math.max(
    3,
    Math.min(maxBarWidth, (band * 0.62 - gap * (series.length - 1)) / Math.max(1, series.length)),
  );
  const groupWidth = barWidth * series.length + gap * (series.length - 1);
  const y = (value: number) =>
    PAD.top + innerHeight - ((value - scale.min) / (scale.max - scale.min || 1)) * innerHeight;
  const zero = y(0);
  const center = (index: number) => PAD.left + band * index + band / 2;

  const linePoints = line
    ? data.map((d, i) => [center(i), y(d.values[line.key] ?? 0)] as [number, number])
    : [];

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((current) => Math.min(data.length - 1, (current ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((current) => Math.max(0, (current ?? data.length) - 1));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const activeDatum = active !== null ? data[active] : null;
  const allSeries = line ? [...series, line] : series;

  return (
    <div
      ref={ref}
      className="relative w-full select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4"
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      onKeyDown={handleKey}
      onBlur={() => setActive(null)}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible">
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--ds-line-strong)" : "var(--ds-chart-grid)"}
              />
              <text
                x={PAD.left - 10}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="num fill-[var(--ds-chart-tick)] text-[11px]"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const groupX = center(i) - groupWidth / 2;
            const dimmed = active !== null && active !== i;
            return (
              <g
                key={`${d.label}-${i}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              >
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={innerHeight}
                  fill={active === i ? "var(--ds-surface-2)" : "transparent"}
                  rx={6}
                  className="transition-[fill] duration-200"
                />
                {series.map((s, si) => {
                  const value = d.values[s.key] ?? 0;
                  const top = value >= 0 ? y(value) : zero;
                  const barHeight = Math.max(value === 0 ? 0 : 1.5, Math.abs(y(value) - zero));
                  const fillColor = negativeColor && value < 0 ? negativeColor : s.color;
                  const r = Math.min(4, barWidth / 2, barHeight);
                  const bx = groupX + si * (barWidth + gap);
                  // Rounded at the data end, square at the baseline.
                  const path =
                    value >= 0
                      ? `M${bx},${top + barHeight}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + barWidth - r}Q${bx + barWidth},${top} ${bx + barWidth},${top + r}V${top + barHeight}Z`
                      : `M${bx},${top}V${top + barHeight - r}Q${bx},${top + barHeight} ${bx + r},${top + barHeight}H${bx + barWidth - r}Q${bx + barWidth},${top + barHeight} ${bx + barWidth},${top + barHeight - r}V${top}Z`;
                  return (
                    <motion.path
                      key={s.key}
                      d={path}
                      fill={fillColor}
                      style={{ originY: value >= 0 ? 1 : 0, transformBox: "fill-box" }}
                      initial={reduceMotion ? false : { scaleY: 0 }}
                      animate={{ scaleY: 1, opacity: dimmed ? 0.35 : 1 }}
                      transition={{
                        scaleY: { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.045 },
                        opacity: { duration: 0.2 },
                      }}
                    />
                  );
                })}
                <text
                  x={center(i)}
                  y={height - 6}
                  textAnchor="middle"
                  className={
                    active === i
                      ? "fill-[var(--ds-foreground)] text-[11px]"
                      : "fill-[var(--ds-chart-tick)] text-[11px]"
                  }
                >
                  {d.label}
                </text>
              </g>
            );
          })}

          {line && linePoints.length > 1 ? (
            <g pointerEvents="none">
              <motion.path
                d={smoothPath(linePoints)}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinecap="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
              />
              {linePoints.map(([cx, cy], i) => (
                <motion.circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={active === i ? 5 : 3.5}
                  fill={line.color}
                  stroke="var(--ds-surface)"
                  strokeWidth={2}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                />
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}

      <TooltipCard
        visible={activeDatum !== null}
        x={active !== null ? center(active) + groupWidth / 2 : 0}
        y={PAD.top}
        containerWidth={width}
      >
        {activeDatum ? (
          <>
            <p className="mb-1.5 text-foreground">{activeDatum.title ?? activeDatum.label}</p>
            {allSeries.map((s) => (
              <TooltipRow key={s.key} color={s.color} label={s.label} value={formatValue(activeDatum.values[s.key] ?? 0)} />
            ))}
          </>
        ) : null}
      </TooltipCard>
    </div>
  );
}
