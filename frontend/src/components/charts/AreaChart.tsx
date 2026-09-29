"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
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

type AreaChartProps = {
  data: Datum[];
  series: Series[];
  height?: number;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  /** Fill the area under each line with a faint wash of its color. */
  fill?: boolean;
  ariaLabel: string;
  yDomain?: [number, number];
};

const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

export function AreaChart({
  data,
  series,
  height = 280,
  formatValue = (value) => money(value),
  formatTick = compactMoney,
  fill = true,
  ariaLabel,
  yDomain,
}: AreaChartProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");

  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = height - PAD.top - PAD.bottom;

  const scale = useMemo(() => {
    const all = data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0));
    const rawMin = yDomain ? yDomain[0] : Math.min(0, ...all);
    const rawMax = yDomain ? yDomain[1] : Math.max(1, ...all);
    return yDomain ? { min: rawMin, max: rawMax, ticks: niceTicks(rawMin, rawMax, 4).ticks.filter((t) => t >= rawMin && t <= rawMax) } : niceTicks(rawMin, rawMax, 4);
  }, [data, series, yDomain]);

  const x = (index: number) =>
    PAD.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) =>
    PAD.top + innerHeight - ((value - scale.min) / (scale.max - scale.min || 1)) * innerHeight;

  const paths = series.map((s) => {
    const points = data.map((d, i) => [x(i), y(d.values[s.key] ?? 0)] as [number, number]);
    const line = smoothPath(points);
    const baseline = y(Math.max(scale.min, 0));
    const area =
      points.length > 0
        ? `${line}L${points[points.length - 1][0]},${baseline}L${points[0][0]},${baseline}Z`
        : "";
    return { series: s, line, area, points };
  });

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left;
    const index = Math.round((relative / (rect.width || 1)) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, index)));
  }

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
  const tooltipY = active !== null ? Math.max(0, Math.min(...paths.map((p) => p.points[active]?.[1] ?? 0)) - 30) : 0;

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
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.1} />
                <stop offset="80%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
            <clipPath id={`${uid}-reveal`}>
              <motion.rect
                x={0}
                y={0}
                height={height}
                initial={reduceMotion ? { width } : { width: 0 }}
                animate={{ width }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </clipPath>
          </defs>

          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--ds-line-strong)" : "var(--ds-chart-grid)"}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-[var(--ds-chart-tick)] text-[11px] num"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => (
            <text
              key={`${d.label}-${i}`}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              className={
                active === i
                  ? "fill-[var(--ds-foreground)] text-[11px] transition-colors"
                  : "fill-[var(--ds-chart-tick)] text-[11px] transition-colors"
              }
            >
              {d.label}
            </text>
          ))}

          <g clipPath={`url(#${uid}-reveal)`}>
            {fill
              ? paths.map((p) => (
                  <path key={`area-${p.series.key}`} d={p.area} fill={`url(#${uid}-${p.series.key})`} />
                ))
              : null}
            {paths.map((p) => (
              <path
                key={`line-${p.series.key}`}
                d={p.line}
                fill="none"
                stroke={p.series.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* End-point dots */}
          {paths.map((p) => {
            const last = p.points[p.points.length - 1];
            if (!last || active !== null) return null;
            return (
              <motion.circle
                key={`end-${p.series.key}`}
                cx={last[0]}
                cy={last[1]}
                r={4}
                fill={p.series.color}
                stroke="var(--ds-surface)"
                strokeWidth={2}
                initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.2, type: "spring", stiffness: 400, damping: 20 }}
              />
            );
          })}

          {active !== null ? (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + innerHeight}
                stroke="var(--ds-line-strong)"
                strokeWidth={1}
              />
              {paths.map((p) => (
                <circle
                  key={`dot-${p.series.key}`}
                  cx={p.points[active][0]}
                  cy={p.points[active][1]}
                  r={4.5}
                  fill={p.series.color}
                  stroke="var(--ds-surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          ) : null}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      ) : null}

      <TooltipCard
        visible={activeDatum !== null}
        x={active !== null ? x(active) : 0}
        y={tooltipY}
        containerWidth={width}
      >
        {activeDatum ? (
          <>
            <p className="mb-1.5 text-foreground">{activeDatum.title ?? activeDatum.label}</p>
            {series.map((s) => (
              <TooltipRow
                key={s.key}
                color={s.color}
                label={s.label}
                value={formatValue(activeDatum.values[s.key] ?? 0)}
              />
            ))}
          </>
        ) : null}
      </TooltipCard>
    </div>
  );
}
