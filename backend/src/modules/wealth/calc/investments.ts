import { ASSET_CLASSES, type AssetClass } from '../../accounts/account-kinds';

/**
 * Investment tracking without market-price feeds: returns from the values
 * the user enters, allocation against a target mix, fee drag and how
 * consistently money goes in.
 */

export type DatedFlow = {
  /** "YYYY-MM-DD". */
  day: string;
  /** Money moved in (+) or out (−) by the user: transfers, not returns. */
  amountCents: number;
};

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/**
 * Modified Dietz return over [start, end]: the gain (value change minus
 * money moved in) divided by the starting value plus money moved in,
 * weighted by how long it was invested. Null when there was nothing
 * invested to earn a return on.
 */
export function modifiedDietz(
  startValueCents: number,
  endValueCents: number,
  flows: readonly DatedFlow[],
  start: string,
  end: string,
): number | null {
  const total = dayNumber(end) - dayNumber(start);
  if (total <= 0) return null;
  let netFlow = 0;
  let weighted = 0;
  for (const flow of flows) {
    if (flow.day <= start || flow.day > end) continue;
    netFlow += flow.amountCents;
    weighted +=
      flow.amountCents * ((dayNumber(end) - dayNumber(flow.day)) / total);
  }
  const base = startValueCents + weighted;
  if (base <= 0) return null;
  return (endValueCents - startValueCents - netFlow) / base;
}

export type AllocationRow = {
  assetClass: AssetClass;
  valueCents: number;
  /** Share of the total, in percent (one decimal). */
  percent: number;
  /** Target share in percent, null when no target is set. */
  targetPercent: number | null;
  /** percent − targetPercent, in percentage points. */
  driftPoints: number | null;
};

export type RebalanceAdvice = 'none' | 'at_yearly_review' | 'now';

/** Drift above 5 points is worth fixing at the yearly review; above 10, now. */
export function rebalanceAdvice(
  maxDriftPoints: number | null,
): RebalanceAdvice {
  if (maxDriftPoints === null || maxDriftPoints <= 5) return 'none';
  return maxDriftPoints > 10 ? 'now' : 'at_yearly_review';
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/** Current mix by asset class against the target mix (basis points). */
export function allocation(
  holdings: ReadonlyArray<{ assetClass: AssetClass; valueCents: number }>,
  targetBps: ReadonlyMap<AssetClass, number>,
): {
  rows: AllocationRow[];
  totalCents: number;
  maxDriftPoints: number | null;
  advice: RebalanceAdvice;
} {
  const byClass = new Map<AssetClass, number>();
  for (const holding of holdings) {
    if (holding.valueCents <= 0) continue;
    byClass.set(
      holding.assetClass,
      (byClass.get(holding.assetClass) ?? 0) + holding.valueCents,
    );
  }
  const totalCents = [...byClass.values()].reduce((sum, v) => sum + v, 0);
  const hasTarget = targetBps.size > 0;

  const rows = ASSET_CLASSES.filter(
    (assetClass) => byClass.has(assetClass) || targetBps.has(assetClass),
  ).map((assetClass) => {
    const valueCents = byClass.get(assetClass) ?? 0;
    const percent =
      totalCents > 0 ? oneDecimal((valueCents / totalCents) * 100) : 0;
    const targetPercent = hasTarget
      ? (targetBps.get(assetClass) ?? 0) / 100
      : null;
    return {
      assetClass,
      valueCents,
      percent,
      targetPercent,
      driftPoints:
        targetPercent === null || totalCents === 0
          ? null
          : oneDecimal(percent - targetPercent),
    };
  });

  const drifts = rows
    .map((row) => row.driftPoints)
    .filter((d): d is number => d !== null);
  const maxDriftPoints = drifts.length
    ? Math.max(...drifts.map(Math.abs))
    : null;
  return {
    rows,
    totalCents,
    maxDriftPoints,
    advice: rebalanceAdvice(maxDriftPoints),
  };
}

/** A low-cost fund's annual fee, used as the comparison for fee drag. */
export const LOW_COST_FEE_BPS = 20;

/**
 * What a fund's fee costs over `years` compared with a low-cost fund, at
 * the same gross return: value × ((1 + r − low)^n − (1 + r − fee)^n).
 */
export function feeDrag(
  valueCents: number,
  feeBps: number,
  returnBps: number,
  years = 20,
): number {
  if (feeBps <= LOW_COST_FEE_BPS || valueCents <= 0) return 0;
  const r = returnBps / 10000;
  const grow = (fee: number) => (1 + r - fee / 10000) ** years;
  return Math.round(valueCents * (grow(LOW_COST_FEE_BPS) - grow(feeBps)));
}

/** Months (of those given) in which money went into investments. */
export function contributionMonths(
  monthlyInvestedCents: readonly number[],
): number {
  return monthlyInvestedCents.filter((cents) => cents > 0).length;
}
