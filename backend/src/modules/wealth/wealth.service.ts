import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import {
  currentYearMonth,
  safeTimezone,
  todayIso,
} from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { financialProfiles, targetAllocations } from '../../db/schema';
import { AccountsService } from '../accounts/accounts.service';
import { ValuationsService } from '../accounts/valuations.service';
import { averageMonthlyEssential } from '../goals/calc/goal-math';
import { currentValue, valueAt } from '../insights/calc/net-worth';
import { incomeSummary, type IncomeKind } from './calc/income';
import {
  allocation,
  contributionMonths,
  feeDrag,
  modifiedDietz,
  type DatedFlow,
} from './calc/investments';
import { SetTargetAllocationDto } from './dto/target-allocation.dto';

type YearMonth = { year: number; month: number };

/** Kinds tracked as investments (returns, allocation, fees). */
const INVESTMENT_KINDS = ['investment', 'retirement'] as const;
/** Months of income history used for growth (two years). */
const INCOME_MONTHS = 24;

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
const sum = (values: readonly number[]) =>
  values.reduce((total, v) => total + v, 0);

@Injectable()
export class WealthService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountsService: AccountsService,
    private readonly valuationsService: ValuationsService,
  ) {}

  /**
   * What the debt planner, FI calculator, investment and income views need,
   * in one response. The interactive maths (payoff schedules, years to FI)
   * runs in the browser from these inputs.
   */
  async getOverview(userId: string, timezone: string) {
    const zone = safeTimezone(timezone);
    const today = todayIso(zone);
    const yearAgo = addDays(today, -365);
    const current = currentYearMonth(zone);
    const firstMonth = fromIndex(toIndex(current) - INCOME_MONTHS);
    const lastComplete = fromIndex(toIndex(current) - 1);

    const [
      balances,
      dailyFlows,
      valuations,
      transferRows,
      incomeRows,
      monthRows,
      targets,
      [profile],
    ] = await Promise.all([
      this.accountsService.getBalances(userId, zone),
      this.accountsService.getDailyFlows(userId, zone),
      this.valuationsService.allByAccount(userId),
      this.investmentTransfers(userId, zone, yearAgo),
      this.incomeByCategory(userId, firstMonth, lastComplete),
      this.monthlyTotals(userId, firstMonth, lastComplete),
      this.getTargets(userId),
      this.db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, userId))
        .limit(1),
    ]);

    const months = Array.from({ length: INCOME_MONTHS }, (_v, i) =>
      key(fromIndex(toIndex(firstMonth) + i)),
    );
    const monthly = months.map(
      (k) => monthRows.get(k) ?? { expense: 0, income: 0, investing: 0 },
    );
    const last12 = monthly.slice(-12);
    const last6 = monthly.slice(-6);
    const assumptions = {
      safeWithdrawalBps: profile?.safeWithdrawalBps ?? 400,
      expectedRealReturnBps: profile?.expectedRealReturnBps ?? 500,
      retirementAgeTarget: profile?.retirementAgeTarget ?? null,
    };

    // ---- debts ----
    const active = balances.accounts.filter((a) => a.archivedAt === null);
    const debts = active
      .filter((a) => a.nature === 'liability' && a.valueCents > 0)
      .map((a) => ({
        accountId: a.id,
        name: a.name,
        kind: a.kind,
        balanceCents: a.valueCents,
        aprBps: a.interestRateBps,
        minimumPaymentCents: a.minimumPaymentCents,
      }));
    const defaultAccount = active.find((a) => a.isDefault) ?? null;

    // ---- investments ----
    const investmentAccounts = balances.accounts.filter(
      (a) =>
        a.nature === 'asset' &&
        (INVESTMENT_KINDS as readonly string[]).includes(a.kind) &&
        (a.archivedAt === null || a.valueCents !== 0),
    );
    const investmentRows = investmentAccounts.map((account) => {
      const valued = {
        nature: account.nature,
        currentBookCents: account.balanceCents,
        flows: dailyFlows.get(account.id) ?? [],
        valuations: valuations.get(account.id) ?? [],
      };
      const startValue = valueAt(valued, yearAgo);
      const endValue = currentValue(valued);
      const flows = transferRows.get(account.id) ?? [];
      const contributed = sum(flows.map((f) => f.amountCents));
      const rate = modifiedDietz(startValue, endValue, flows, yearAgo, today);
      const fee = account.expenseRatioBps ?? 0;
      return {
        accountId: account.id,
        name: account.name,
        kind: account.kind,
        assetClass: account.assetClass ?? 'other',
        assetClassSet: account.assetClass !== null,
        valueCents: endValue,
        startValueCents: startValue,
        contributedCents: contributed,
        gainCents: endValue - startValue - contributed,
        returnPercent: rate === null ? null : Math.round(rate * 1000) / 10,
        hasValuation: account.lastValuation !== null,
        lastValuedOn: account.lastValuation?.date ?? null,
        expenseRatioBps: account.expenseRatioBps,
        annualFeeCents: Math.round((Math.max(0, endValue) * fee) / 10000),
        feeDrag20yCents: feeDrag(
          endValue,
          fee,
          assumptions.expectedRealReturnBps,
        ),
      };
    });
    const investedCents = sum(investmentRows.map((r) => r.valueCents));
    const startTotal = sum(investmentRows.map((r) => r.startValueCents));
    const totalFlows = investmentRows.flatMap(
      (r) => transferRows.get(r.accountId) ?? [],
    );
    const totalRate = modifiedDietz(
      startTotal,
      investedCents,
      totalFlows,
      yearAgo,
      today,
    );

    // ---- income ----
    const income = incomeSummary(
      [...incomeRows.values()].map((row) => ({
        ...row,
        monthlyCents: months.map((k) => row.byMonth.get(k) ?? 0),
      })),
      sum(last12.map((m) => m.expense)),
    );

    const averageExpense = averageMonthlyEssential(
      last12.map((m) => m.expense),
    );
    const averageIncome = averageMonthlyEssential(last6.map((m) => m.income));

    return {
      asOf: today,
      assumptions,
      debts,
      defaultAccount: defaultAccount
        ? { id: defaultAccount.id, name: defaultAccount.name }
        : null,
      fi: {
        monthlyExpenseCents: averageExpense,
        annualExpenseCents:
          averageExpense === null ? null : averageExpense * 12,
        monthlyIncomeCents: averageIncome,
        investedCents,
        monthlyInvestingCents: Math.round(
          sum(last6.map((m) => m.investing)) / 6,
        ),
        passiveCoverage: income.passiveCoverage,
      },
      investments: {
        accounts: investmentRows,
        totalCents: investedCents,
        returnPercent:
          totalRate === null ? null : Math.round(totalRate * 1000) / 10,
        allocation: allocation(
          investmentRows,
          new Map(targets.map((t) => [t.assetClass, t.percentBps])),
        ),
        targets: targets.map((t) => ({
          assetClass: t.assetClass,
          percent: t.percentBps / 100,
        })),
        annualFeesCents: sum(investmentRows.map((r) => r.annualFeeCents)),
        feeDrag20yCents: sum(investmentRows.map((r) => r.feeDrag20yCents)),
        contributionMonths: contributionMonths(last12.map((m) => m.investing)),
      },
      income,
    };
  }

  /** Replaces the target mix; shares must add up to 100%. */
  async setTargets(userId: string, dto: SetTargetAllocationDto) {
    const classes = new Set(dto.targets.map((t) => t.assetClass));
    if (classes.size !== dto.targets.length) {
      throw new BadRequestException('Each asset class can appear once');
    }
    const bps = dto.targets.map((t) => ({
      assetClass: t.assetClass,
      percentBps: Math.round(t.percent * 100),
    }));
    if (bps.length && sum(bps.map((t) => t.percentBps)) !== 10000) {
      throw new BadRequestException('Target shares must add up to 100%');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(targetAllocations)
        .where(eq(targetAllocations.userId, userId));
      if (bps.length) {
        await tx
          .insert(targetAllocations)
          .values(bps.map((t) => ({ userId, ...t })));
      }
    });
    return (await this.getTargets(userId)).map((t) => ({
      assetClass: t.assetClass,
      percent: t.percentBps / 100,
    }));
  }

  // ---- queries ----

  private getTargets(userId: string) {
    return this.db
      .select({
        assetClass: targetAllocations.assetClass,
        percentBps: targetAllocations.percentBps,
      })
      .from(targetAllocations)
      .where(eq(targetAllocations.userId, userId))
      .orderBy(asc(targetAllocations.assetClass));
  }

  /**
   * Money the user moved into (+) or out of (−) each investment account per
   * day since `since`. Income and expenses recorded in the account (dividends,
   * fees) are returns, not contributions, so only transfers count.
   */
  private async investmentTransfers(
    userId: string,
    zone: string,
    since: string,
  ): Promise<Map<string, DatedFlow[]>> {
    const rows = await this.db.execute<{
      account_id: string;
      day: string;
      amount_cents: number | string;
    }>(sql`
      SELECT a.id AS account_id,
             (t.date AT TIME ZONE ${zone})::date::text AS day,
             SUM(CASE WHEN t.counter_account_id = a.id THEN t.amount_cents ELSE -t.amount_cents END) AS amount_cents
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id OR a.id = t.counter_account_id
      WHERE t.user_id = ${userId}
        AND t.type = 'transfer'
        AND t.deleted_at IS NULL
        AND a.kind IN ('investment', 'retirement')
        AND (t.date AT TIME ZONE ${zone})::date > ${since}::date
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);
    const byAccount = new Map<string, DatedFlow[]>();
    for (const row of rows) {
      const list = byAccount.get(row.account_id) ?? [];
      list.push({ day: row.day, amountCents: Number(row.amount_cents) });
      byAccount.set(row.account_id, list);
    }
    return byAccount;
  }

  /** Income per category and billing month, with each category's kind. */
  private async incomeByCategory(
    userId: string,
    from: YearMonth,
    to: YearMonth,
  ) {
    const rows = await this.db.execute<{
      category_id: string;
      name: string;
      income_kind: IncomeKind | null;
      year: number | string;
      month: number | string;
      cents: number | string;
    }>(sql`
      SELECT c.id AS category_id, c.name, c.income_kind,
             t.transaction_year AS year, t.transaction_month AS month,
             SUM(t.amount_cents) AS cents
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.type = 'income'
        AND t.deleted_at IS NULL
        AND (t.transaction_year, t.transaction_month) >= (${from.year}, ${from.month})
        AND (t.transaction_year, t.transaction_month) <= (${to.year}, ${to.month})
      GROUP BY 1, 2, 3, 4, 5
    `);
    const byCategory = new Map<
      string,
      {
        categoryId: string;
        name: string;
        kind: IncomeKind;
        byMonth: Map<string, number>;
      }
    >();
    for (const row of rows) {
      const entry = byCategory.get(row.category_id) ?? {
        categoryId: row.category_id,
        name: row.name,
        kind: row.income_kind ?? 'unclassified',
        byMonth: new Map<string, number>(),
      };
      entry.byMonth.set(
        key({ year: Number(row.year), month: Number(row.month) }),
        Number(row.cents),
      );
      byCategory.set(row.category_id, entry);
    }
    return byCategory;
  }

  /** Per billing month: income, spending and money moved into investments. */
  private async monthlyTotals(userId: string, from: YearMonth, to: YearMonth) {
    const rows = await this.db.execute<{
      year: number | string;
      month: number | string;
      income: string | null;
      expense: string | null;
      investing: string | null;
    }>(sql`
      SELECT t.transaction_year AS year, t.transaction_month AS month,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'income') AS income,
        SUM(t.amount_cents) FILTER (WHERE t.type = 'expense') AS expense,
        SUM(t.amount_cents) FILTER (
          WHERE t.type = 'transfer' AND f.nature = 'asset' AND d.kind IN ('investment', 'retirement')
        ) AS investing
      FROM transactions t
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
          investing: Number(row.investing ?? 0),
        },
      ]),
    );
  }
}
