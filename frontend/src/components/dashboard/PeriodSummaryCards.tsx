"use client";

import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { StatTile, pct, usd, type Delta } from "@/components/dashboard/primitives";

interface PeriodSummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
  savings: number;
  savingsRate: string;
  isLoading: boolean;
  /** Previous comparable period, when available. */
  previous?: { totalIncome: number; totalExpense: number; savings: number; savingsRate: number } | null;
  against?: string;
  trends?: { income: number[]; expense: number[]; savings: number[] };
}

export function PeriodSummaryCards({
  totalIncome,
  totalExpense,
  savings,
  savingsRate,
  isLoading,
  previous,
  against = "previous period",
  trends,
}: PeriodSummaryCardsProps) {
  const rate = Number(savingsRate) || 0;
  const delta = (value: number, upIsGood: boolean, format: (v: number) => string): Delta | null =>
    previous ? { value, upIsGood, against, format } : null;

  const cards = [
    {
      label: "Income",
      value: totalIncome,
      format: usd,
      dot: "var(--ds-series-income)",
      delta: delta(totalIncome - (previous?.totalIncome ?? 0), true, usd),
      trend: trends?.income,
    },
    {
      label: "Expenses",
      value: totalExpense,
      format: usd,
      dot: "var(--ds-series-expense)",
      delta: delta(totalExpense - (previous?.totalExpense ?? 0), false, usd),
      trend: trends?.expense,
    },
    {
      label: "Net savings",
      value: savings,
      format: (v: number) => `${v < 0 ? "-" : ""}${usd(Math.abs(v))}`,
      dot: "var(--ds-series-net)",
      delta: delta(savings - (previous?.savings ?? 0), true, usd),
      trend: trends?.savings,
    },
    {
      label: "Savings rate",
      value: rate,
      format: pct,
      dot: undefined,
      delta: delta(rate - (previous?.savingsRate ?? 0), true, (v: number) => `${v.toFixed(1)} pts`),
      trend: undefined,
    },
  ];

  return (
    <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StaggerItem key={card.label}>
          <StatTile
            label={card.label}
            value={card.value}
            format={card.format}
            dotColor={card.dot}
            delta={card.delta}
            trend={card.trend}
            trendColor={card.dot}
            isLoading={isLoading}
          />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
