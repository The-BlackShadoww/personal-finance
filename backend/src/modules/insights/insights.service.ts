import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  currentYearMonth,
  safeTimezone,
  todayIso,
} from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { financialProfiles } from '../../db/schema';
import { trailingMonths } from '../accounts/calc/balances';
import {
  AccountsService,
  type AccountWithBalance,
} from '../accounts/accounts.service';
import {
  VALUED_KINDS,
  ValuationsService,
} from '../accounts/valuations.service';
import { averageMonthlyEssential } from '../goals/calc/goal-math';
import { GoalsService } from '../goals/goals.service';
import { scoreHealth } from './calc/health-score';
import { netWorthSeries, type ValuedAccount } from './calc/net-worth';
import { nextBestAction } from './calc/next-action';
import { runway } from './calc/runway';
import {
  detectDrift,
  detectLifestyleCreep,
  detectSubscriptions,
  detectUnusual,
  rankInsights,
  type CategorySpend,
  type ExpenseSample,
} from './calc/spending-insights';

type YearMonth = { year: number; month: number };

type MonthRow = {
  year: number | string;
  month: number | string;
  income: string | null;
  expense: string | null;
  essential: string | null;
  fixed: string | null;
  housing: string | null;
  debt_interest: string | null;
  investing: string | null;
  debt_payment: string | null;
};

type MonthFlows = {
  income: number;
  expense: number;
  essential: number;
  fixed: number;
  housing: number;
  debtInterest: number;
  investing: number;
  debtPayment: number;
};

type ExpenseRow = {
  id: string;
  category_id: string;
  category_name: string;
  amount_cents: number | string;
  day: string;
  note: string | null;
  recurring: boolean;
  year: number | string;
  month: number | string;
};

/** Complete months of history the insights look back over. */
const HISTORY_MONTHS = 12;
/** Months of activity needed before history-based advice is given. */
const MIN_HISTORY_MONTHS = 3;
/** APR at or above which a debt is "high interest", in basis points. */
const HIGH_INTEREST_BPS = 800;
/** Investment values older than this prompt an update. */
const STALE_VALUATION_DAYS = 31;
/** Unusual-transaction check covers expenses this recent. */
const RECENT_DAYS = 30;

const EMPTY_FLOWS: MonthFlows = {
  income: 0,
  expense: 0,
  essential: 0,
  fixed: 0,
  housing: 0,
  debtInterest: 0,
  investing: 0,
  debtPayment: 0,
};

const toIndex = ({ year, month }: YearMonth) => year * 12 + (month - 1);
const fromIndex = (index: number): YearMonth => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});
const key = ({ year, month }: YearMonth) => `${year}-${month}`;
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
const sumOf = (rows: readonly MonthFlows[], field: keyof MonthFlows) =>
  rows.reduce((sum, row) => sum + row[field], 0);

@Injectable()
export class InsightsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountsService: AccountsService,
    private readonly valuationsService: ValuationsService,
    private readonly goalsService: GoalsService,
  ) {}

  /**
   * Everything the Insights page shows in one response: net worth and its
   * history, runway, the health score with its breakdown, the next best
   * action, spending insights and stale investment values.
   */
  async getOverview(userId: string, timezone: string, months = 24) {
    const zone = safeTimezone(timezone);
    const today = todayIso(zone);
    const current = currentYearMonth(zone);
    const firstComplete = fromIndex(toIndex(current) - HISTORY_MONTHS);

    const [
      monthRows,
      expenseRows,
      ruleRows,
      balances,
      dailyFlows,
      valuations,
      goals,
      [profile],
    ] = await Promise.all([
      this.monthlyFlows(userId, firstComplete, current),
      this.expenseSamples(userId, zone, firstComplete, current),
      this.db.execute<{
        category_id: string | null;
        amount_cents: number | string;
      }>(sql`
          SELECT category_id, amount_cents FROM recurring_rules
          WHERE user_id = ${userId} AND type = 'expense'
        `),
      this.accountsService.getBalances(userId, zone),
      this.accountsService.getDailyFlows(userId, zone),
      this.valuationsService.allByAccount(userId),
      this.goalsService.list(userId, zone),
      this.db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, userId))
        .limit(1),
    ]);

    // Complete months, oldest first, zero-filled.
    const complete = Array.from(
      { length: HISTORY_MONTHS },
      (_v, i) =>
        monthRows.get(key(fromIndex(toIndex(firstComplete) + i))) ??
        EMPTY_FLOWS,
    );
    const last6 = complete.slice(-6);
    const last3 = complete.slice(-3);
    const activeMonths = last6.filter(
      (m) => m.income > 0 || m.expense > 0,
    ).length;
    const hasHistory = activeMonths >= MIN_HISTORY_MONTHS;

    const averageIncome = averageMonthlyEssential(last6.map((m) => m.income));
    const averageExpense = averageMonthlyEssential(last6.map((m) => m.expense));
    const averageSurplus =
      averageIncome === null ? null : averageIncome - (averageExpense ?? 0);
    const averageEssential = goals.summary.averageEssentialMonthlyCents;

    // ---- net worth ----
    const currentKey = `${current.year}-${String(current.month).padStart(2, '0')}`;
    const seriesMonths = trailingMonths(currentKey, Math.max(months, 7));
    const valued: ValuedAccount[] = balances.accounts.map((account) => ({
      nature: account.nature,
      currentBookCents: account.balanceCents,
      flows: dailyFlows.get(account.id) ?? [],
      valuations: valuations.get(account.id) ?? [],
    }));
    const fullSeries = netWorthSeries(valued, seriesMonths);
    const series = fullSeries.slice(-months);
    const sixMonthsAgo = fullSeries[fullSeries.length - 7];

    // ---- debts, goals, profile ----
    const highInterestDebts = this.highInterestDebts(balances.accounts);
    const emergencyGoal = goals.goals.find((goal) => goal.kind === 'emergency');
    const emergency = {
      balanceCents: emergencyGoal?.balanceCents ?? 0,
      averageEssentialCents: averageEssential,
      targetMonths: emergencyGoal?.emergency?.targetMonths ?? 3,
    };
    const protection = {
      hasHealthInsurance: profile?.hasHealthInsurance ?? null,
      hasLifeInsurance: profile?.hasLifeInsurance ?? null,
      dependents: profile?.dependents ?? null,
    };
    const inAYear = addDays(today, 365);
    const sinkingBehind = goals.goals
      .filter(
        (goal) =>
          goal.kind === 'sinking' &&
          goal.progress.status === 'behind' &&
          goal.targetDate !== null &&
          goal.targetDate <= inAYear,
      )
      .map((goal) => ({
        goalId: goal.id,
        name: goal.name,
        targetDate: goal.targetDate as string,
        shortfallMonthlyCents: Math.max(
          0,
          (goal.progress.requiredMonthlyCents ?? 0) - goal.paceMonthlyCents,
        ),
      }))
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

    const trailing = {
      incomeCents: sumOf(last3, 'income'),
      expenseCents: sumOf(last3, 'expense'),
      investingCents: sumOf(last3, 'investing'),
      debtPaymentCents: sumOf(last3, 'debtPayment'),
      debtInterestCents: sumOf(last3, 'debtInterest'),
      housingCents: sumOf(last3, 'housing'),
      fixedCents: sumOf(last3, 'fixed'),
    };

    const health = scoreHealth({
      hasHistory,
      trailing,
      emergency,
      highInterestDebtCents: highInterestDebts.reduce(
        (sum, d) => sum + d.balanceCents,
        0,
      ),
      netWorthMonthEnds: fullSeries
        .slice(-7)
        .map((point) => point.netWorthCents),
      averageMonthlyIncomeCents: averageIncome,
      protection,
    });

    const nextAction = nextBestAction({
      availableCents: goals.summary.availableCents,
      hasHistory,
      averageMonthlyIncomeCents: averageIncome,
      averageMonthlySurplusCents: averageSurplus,
      emergency,
      employerMatchPercent: profile?.employerMatchPercent ?? null,
      investingMonthlyCents: Math.round(trailing.investingCents / 3),
      highInterestDebts,
      sinkingBehind,
      protection,
    });

    // ---- spending insights ----
    const samples: ExpenseSample[] = expenseRows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      amountCents: Number(row.amount_cents),
      date: row.day,
      note: row.note,
      recurring: row.recurring,
    }));
    const insights = rankInsights([
      ...detectLifestyleCreep(
        last6.map((m) => m.income),
        last6.map((m) => m.expense),
      ),
      ...detectDrift(this.categorySpend(expenseRows, current), averageIncome),
      ...detectUnusual(samples, addDays(today, -RECENT_DAYS)),
      ...detectSubscriptions(
        samples,
        ruleRows.map((rule) => ({
          categoryId: rule.category_id,
          amountCents: Number(rule.amount_cents),
        })),
        today,
      ),
    ]);

    const percent = (part: number) =>
      trailing.incomeCents > 0 && hasHistory
        ? Math.round((part / trailing.incomeCents) * 1000) / 10
        : null;

    return {
      asOf: today,
      /** Ratios use take-home pay, which is stricter than gross-income rules. */
      incomeBasis: 'take_home' as const,
      hasHistory,
      netWorth: {
        currentCents: balances.totals.netWorthCents,
        assetsCents: balances.totals.assetsCents,
        liabilitiesCents: balances.totals.liabilitiesCents,
        changeSixMonthsCents: sixMonthsAgo
          ? balances.totals.netWorthCents - sixMonthsAgo.netWorthCents
          : null,
        series,
      },
      availableToSpendCents: goals.summary.availableCents,
      runway: runway(
        balances.totals.liquidCents,
        averageExpense,
        averageEssential,
      ),
      rates: {
        savingsRate: percent(trailing.incomeCents - trailing.expenseCents),
        investingRate: percent(trailing.investingCents),
      },
      averages: {
        incomeCents: averageIncome,
        expenseCents: averageExpense,
        essentialCents: averageEssential,
      },
      health,
      nextAction,
      insights,
      valuationPrompts: this.valuationPrompts(balances.accounts, today),
    };
  }

  /** The compact version the dashboard shows beside the month's numbers. */
  async getDashboardSummary(userId: string, timezone: string) {
    const overview = await this.getOverview(userId, timezone, 7);
    return {
      netWorth: {
        currentCents: overview.netWorth.currentCents,
        changeSixMonthsCents: overview.netWorth.changeSixMonthsCents,
        trend: overview.netWorth.series.map((point) => point.netWorthCents),
      },
      runway: overview.runway,
      health: { score: overview.health.score, band: overview.health.band },
      nextAction: overview.nextAction,
      insights: overview.insights,
      valuationPrompts: overview.valuationPrompts,
    };
  }

  /** Month-end net worth for the last `months` months, the last being now. */
  async getNetWorthSeries(userId: string, timezone: string, months: number) {
    const zone = safeTimezone(timezone);
    const current = currentYearMonth(zone);
    const [balances, dailyFlows, valuations] = await Promise.all([
      this.accountsService.getBalances(userId, zone),
      this.accountsService.getDailyFlows(userId, zone),
      this.valuationsService.allByAccount(userId),
    ]);
    const valued = balances.accounts.map((account) => ({
      nature: account.nature,
      currentBookCents: account.balanceCents,
      flows: dailyFlows.get(account.id) ?? [],
      valuations: valuations.get(account.id) ?? [],
    }));
    return netWorthSeries(
      valued,
      trailingMonths(
        `${current.year}-${String(current.month).padStart(2, '0')}`,
        months,
      ),
    );
  }

  // ---- queries ----

  /**
   * Per billing month: income, spending and its need/fixed/housing/interest
   * parts, and transfers out of the user's own money into investments and
   * onto debts (as in `transferPurpose`).
   */
  private async monthlyFlows(userId: string, from: YearMonth, to: YearMonth) {
    const rows = await this.db.execute<MonthRow>(sql`
      SELECT t.transaction_year AS year, t.transaction_month AS month,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'income') AS income,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'expense') AS expense,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'expense' AND c.essential) AS essential,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'expense' AND c.fixed) AS fixed,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'expense' AND c.tag = 'housing') AS housing,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'expense' AND c.tag = 'debt_interest') AS debt_interest,
        SUM(t.amount_cents) FILTER (
          WHERE t.type = 'transfer' AND f.nature = 'asset' AND d.kind IN ('investment', 'retirement')
        ) AS investing,
        SUM(t.amount_cents) FILTER (
          WHERE t.type = 'transfer' AND f.nature = 'asset' AND d.nature = 'liability'
        ) AS debt_payment
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      JOIN accounts f ON f.id = t.account_id
      LEFT JOIN accounts d ON d.id = t.counter_account_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND (t.transaction_year, t.transaction_month) >= (${from.year}, ${from.month})
        AND (t.transaction_year, t.transaction_month) <= (${to.year}, ${to.month})
      GROUP BY 1, 2
    `);
    return new Map(
      rows.map((row) => [
        key({ year: Number(row.year), month: Number(row.month) }),
        {
          income: Number(row.income ?? 0),
          expense: Number(row.expense ?? 0),
          essential: Number(row.essential ?? 0),
          fixed: Number(row.fixed ?? 0),
          housing: Number(row.housing ?? 0),
          debtInterest: Number(row.debt_interest ?? 0),
          investing: Number(row.investing ?? 0),
          debtPayment: Number(row.debt_payment ?? 0),
        } satisfies MonthFlows,
      ]),
    );
  }

  /** Every expense in the window, for drift, outliers and subscriptions. */
  private expenseSamples(
    userId: string,
    zone: string,
    from: YearMonth,
    to: YearMonth,
  ) {
    return this.db.execute<ExpenseRow>(sql`
      SELECT t.id, t.category_id, c.name AS category_name, t.amount_cents,
             (t.date AT TIME ZONE ${zone})::date::text AS day, t.note,
             t.recurring_rule_id IS NOT NULL AS recurring,
             t.transaction_year AS year, t.transaction_month AS month
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.type = 'expense'
        AND t.deleted_at IS NULL
        AND (t.transaction_year, t.transaction_month) >= (${from.year}, ${from.month})
        AND (t.transaction_year, t.transaction_month) <= (${to.year}, ${to.month})
    `);
  }

  // ---- shaping ----

  /** Spending per category: the three complete months before this one, and this month. */
  private categorySpend(
    rows: readonly ExpenseRow[],
    current: YearMonth,
  ): CategorySpend[] {
    const currentIndex = toIndex(current);
    const byCategory = new Map<string, CategorySpend>();
    for (const row of rows) {
      const offset =
        currentIndex -
        toIndex({ year: Number(row.year), month: Number(row.month) });
      if (offset < 0 || offset > 3) continue;
      const entry = byCategory.get(row.category_id) ?? {
        categoryId: row.category_id,
        name: row.category_name,
        previousCents: [0, 0, 0] as [number, number, number],
        currentCents: 0,
      };
      const cents = Number(row.amount_cents);
      if (offset === 0) entry.currentCents += cents;
      else entry.previousCents[3 - offset] += cents;
      byCategory.set(row.category_id, entry);
    }
    return [...byCategory.values()];
  }

  /**
   * Debts charging 8% APR or more, highest rate first. A card with no rate
   * entered is assumed to be high interest (cards almost always are) and
   * listed after those with known rates.
   */
  private highInterestDebts(accounts: readonly AccountWithBalance[]) {
    return accounts
      .filter(
        (account) =>
          account.nature === 'liability' &&
          account.valueCents > 0 &&
          (account.interestRateBps === null
            ? account.kind === 'credit_card'
            : account.interestRateBps >= HIGH_INTEREST_BPS),
      )
      .map((account) => ({
        accountId: account.id,
        name: account.name,
        balanceCents: account.valueCents,
        aprBps: account.interestRateBps,
      }))
      .sort((a, b) => (b.aprBps ?? -1) - (a.aprBps ?? -1));
  }

  /** Investment and property accounts whose value has not been updated in a month. */
  private valuationPrompts(
    accounts: readonly AccountWithBalance[],
    today: string,
  ) {
    return accounts
      .filter(
        (account) =>
          account.archivedAt === null &&
          account.nature === 'asset' &&
          VALUED_KINDS.includes(account.kind) &&
          // "Other" accounts only once the user has started valuing them.
          (account.kind !== 'other' || account.lastValuation !== null) &&
          (account.lastValuation !== null || account.balanceCents !== 0),
      )
      .map((account) => ({
        accountId: account.id,
        name: account.name,
        kind: account.kind,
        lastValuedOn: account.lastValuation?.date ?? null,
        daysSince: account.lastValuation
          ? daysBetween(account.lastValuation.date, today)
          : null,
      }))
      .filter(
        (prompt) =>
          prompt.daysSince === null || prompt.daysSince > STALE_VALUATION_DAYS,
      );
  }
}
