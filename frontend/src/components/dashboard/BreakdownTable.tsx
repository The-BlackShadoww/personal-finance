"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { MonthlyBreakdownItem } from "@/lib/api/calculations";
import { cn } from "@/lib/utils/cn";
import { formatDollar, monthName } from "@/lib/utils/format";

interface BreakdownTableProps {
  rows: MonthlyBreakdownItem[];
  year: number;
  comparisonRows?: MonthlyBreakdownItem[];
  comparisonYear?: number;
  isLoading: boolean;
}

function signed(value: number) {
  return `${value < 0 ? "-" : ""}${formatDollar(value)}`;
}

export function BreakdownTable({ rows, comparisonRows, comparisonYear, isLoading }: BreakdownTableProps) {
  const reduceMotion = useReducedMotion();
  const hasComparison = Boolean(comparisonRows && comparisonRows.length > 0);
  const totalIncome = rows.reduce((sum, row) => sum + row.totalIncome, 0);
  const totalExpense = rows.reduce((sum, row) => sum + row.totalExpense, 0);
  const totalSavings = rows.reduce((sum, row) => sum + row.savings, 0);
  const maxFlow = Math.max(1, ...rows.map((row) => Math.max(row.totalIncome, row.totalExpense)));

  const getComparisonRow = (month: number) => comparisonRows?.find((row) => row.month === month);
  const columns = hasComparison ? 6 : 5;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-[12px] text-muted">
              <th className="px-6 py-3.5 text-left font-normal">Month</th>
              <th className="px-4 py-3.5 text-left font-normal">Flow</th>
              <th className="px-4 py-3.5 text-right font-normal">Income</th>
              <th className="px-4 py-3.5 text-right font-normal">Expenses</th>
              <th className="px-6 py-3.5 text-right font-normal">Savings</th>
              {hasComparison && <th className="px-6 py-3.5 text-right font-normal">vs {comparisonYear}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading
              ? Array.from({ length: 3 }, (_value, index) => (
                  <tr key={index}>
                    {Array.from({ length: columns }, (_c, cell) => (
                      <td key={cell} className="px-6 py-4">
                        <div className="skeleton h-4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, index) => {
                  const comparison = getComparisonRow(row.month);
                  const savingsDiff = comparison !== undefined ? row.savings - comparison.savings : null;
                  const hasActivity = row.totalIncome !== 0 || row.totalExpense !== 0;

                  return (
                    <motion.tr
                      key={row.month}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.03 }}
                      className="transition-colors hover:bg-surface-2/70"
                    >
                      <td className="px-6 py-3.5 text-foreground">{monthName(row.month)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex w-32 flex-col gap-[3px]" aria-hidden="true">
                          <span
                            className="h-[3px] rounded-full bg-income"
                            style={{ width: `${(row.totalIncome / maxFlow) * 100}%`, minWidth: row.totalIncome ? 2 : 0 }}
                          />
                          <span
                            className="h-[3px] rounded-full bg-expense"
                            style={{ width: `${(row.totalExpense / maxFlow) * 100}%`, minWidth: row.totalExpense ? 2 : 0 }}
                          />
                        </div>
                      </td>
                      <td className="num px-4 py-3.5 text-right text-foreground">
                        {row.totalIncome > 0 ? formatDollar(row.totalIncome) : <span className="text-faint">—</span>}
                      </td>
                      <td className="num px-4 py-3.5 text-right text-foreground">
                        {row.totalExpense > 0 ? formatDollar(row.totalExpense) : <span className="text-faint">—</span>}
                      </td>
                      <td
                        className={cn(
                          "num px-6 py-3.5 text-right",
                          row.savings > 0 ? "text-green-fg" : row.savings < 0 ? "text-red-fg" : "text-muted",
                        )}
                      >
                        {hasActivity ? signed(row.savings) : <span className="text-faint">—</span>}
                      </td>
                      {hasComparison && (
                        <td className="px-6 py-3.5 text-right">
                          {savingsDiff === null ? (
                            <span className="text-faint">—</span>
                          ) : savingsDiff === 0 ? (
                            <span className="text-[12px] text-muted">No change</span>
                          ) : (
                            <span
                              className={cn(
                                "tag num normal-case tracking-normal",
                                savingsDiff > 0 ? "bg-green-bg text-green-fg" : "bg-red-bg text-red-fg",
                              )}
                            >
                              {savingsDiff > 0 ? "Up " : "Down "}
                              {formatDollar(Math.abs(savingsDiff))}
                            </span>
                          )}
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
          </tbody>
          {!isLoading && rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-line bg-surface-2/60">
                <td className="px-6 py-4 text-[13px] text-muted">Total</td>
                <td />
                <td className="num px-4 py-4 text-right text-foreground">{formatDollar(totalIncome)}</td>
                <td className="num px-4 py-4 text-right text-foreground">{formatDollar(totalExpense)}</td>
                <td
                  className={cn(
                    "num px-6 py-4 text-right",
                    totalSavings > 0 ? "text-green-fg" : totalSavings < 0 ? "text-red-fg" : "text-muted",
                  )}
                >
                  {signed(totalSavings)}
                </td>
                {hasComparison && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
