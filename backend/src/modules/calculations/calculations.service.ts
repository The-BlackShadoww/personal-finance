import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { AccountService } from '../account/account.service';
import { InsightsService } from '../insights/insights.service';
import {
  transferPurpose,
  type AccountKind,
  type AccountNature,
} from '../accounts/account-kinds';

type MonthlyAggregationRow = {
  year: number | string;
  month: number | string;
  total_income_cents: number | string | null;
  total_expense_cents: number | string | null;
  transaction_count: number | string;
};

type CategoryBreakdownRow = {
  name: string;
  color: string | null;
  icon: string | null;
  type: 'income' | 'expense';
  total_cents: number | string | null;
  count: number | string;
};

type TransferRouteRow = {
  from_nature: AccountNature;
  to_kind: AccountKind;
  to_nature: AccountNature;
  total_cents: number | string | null;
};

type YearMonth = { year: number; month: number };

type MonthTotals = {
  incomeCents: number;
  expenseCents: number;
  count: number;
};

const EMPTY_TOTALS: MonthTotals = { incomeCents: 0, expenseCents: 0, count: 0 };

@Injectable()
export class CalculationsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountService: AccountService,
    private readonly insightsService: InsightsService,
  ) {}

  // Billing period is explicit — no timezone conversion needed.
  // transaction_month and transaction_year were set by the user when recording the transaction.

  async getMonthlySummary(userId: string, year: number, month: number) {
    this.assertMonth(month);
    const period = { year, month };
    const totals = await this.getMonthTotals(userId, period, period);

    return this.toMonthlySummary(
      period,
      totals.get(this.periodKey(year, month)),
    );
  }

  async getQuarterlySummary(userId: string, year: number, quarter: number) {
    this.assertQuarter(quarter);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const totals = await this.getMonthTotals(
      userId,
      { year, month: startMonth },
      { year, month: endMonth },
    );

    return {
      year,
      quarter,
      startMonth,
      endMonth,
      ...this.buildPeriod(totals, year, startMonth, endMonth),
    };
  }

  async getYearlySummary(userId: string, year: number) {
    const totals = await this.getMonthTotals(
      userId,
      { year, month: 1 },
      { year, month: 12 },
    );

    return { year, ...this.buildPeriod(totals, year, 1, 12) };
  }

  /**
   * Totals across an inclusive span of months, possibly crossing years.
   * Replaces fetching one monthly summary per month in the range.
   */
  async getRangeSummary(userId: string, start: YearMonth, end: YearMonth) {
    this.assertMonth(start.month);
    this.assertMonth(end.month);

    if (this.monthIndex(end) < this.monthIndex(start)) {
      throw new BadRequestException('End period cannot be before start period');
    }

    const totals = await this.getMonthTotals(userId, start, end);
    const combined = this.sumTotals(totals.values());

    return {
      startYear: start.year,
      startMonth: start.month,
      endYear: end.year,
      endMonth: end.month,
      monthsIncluded: this.monthIndex(end) - this.monthIndex(start) + 1,
      ...this.toPeriodSummary(combined),
    };
  }

  /** Income and spending in cents for each month in [start, end], zero-filled, oldest first. */
  async getMonthlyTotals(userId: string, start: YearMonth, end: YearMonth) {
    const totals = await this.getMonthTotals(userId, start, end);
    const count = this.monthIndex(end) - this.monthIndex(start) + 1;
    return Array.from({ length: Math.max(0, count) }, (_value, offset) => {
      const index = this.monthIndex(start) + offset;
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      const row = totals.get(this.periodKey(year, month)) ?? EMPTY_TOTALS;
      return {
        year,
        month,
        incomeCents: row.incomeCents,
        expenseCents: row.expenseCents,
      };
    });
  }

  /**
   * Everything the monthly dashboard renders, in one request: the selected
   * month, the year(s) its six-month trend spans, the category breakdown,
   * the account balance and today's insights (net worth, runway, health
   * score, next best action). The independent queries run concurrently.
   */
  async getDashboardOverview(
    userId: string,
    year: number,
    month: number,
    timezone = 'UTC',
  ) {
    this.assertMonth(month);
    // The trend covers the six months ending at the selected one, which
    // reaches into the previous year for January–May.
    const includesPreviousYear = month < 6;
    const firstYear = includesPreviousYear ? year - 1 : year;

    const [totals, categoryBreakdown, account, surplusAllocation, insights] =
      await Promise.all([
        this.getMonthTotals(
          userId,
          { year: firstYear, month: 1 },
          { year, month: 12 },
        ),
        this.getCategoryBreakdown(userId, year, month),
        this.accountService.getAccountSummary(userId, timezone),
        this.getSurplusAllocation(userId, year, month),
        this.insightsService.getDashboardSummary(userId, timezone),
      ]);

    return {
      year,
      month,
      monthly: this.toMonthlySummary(
        { year, month },
        totals.get(this.periodKey(year, month)),
      ),
      yearly: { year, ...this.buildPeriod(totals, year, 1, 12) },
      previousYearly: includesPreviousYear
        ? { year: year - 1, ...this.buildPeriod(totals, year - 1, 1, 12) }
        : null,
      categoryBreakdown,
      surplusAllocation,
      account,
      insights,
    };
  }

  /**
   * Where the month's surplus went: transfers out of the user's own money
   * into savings, investments and debt. Transfers are never income or
   * spending, so this is reported beside the savings rate, not inside it.
   */
  async getSurplusAllocation(userId: string, year: number, month: number) {
    this.assertMonth(month);

    const rows = await this.db.execute<TransferRouteRow>(sql`
      SELECT f.nature AS from_nature, d.kind AS to_kind, d.nature AS to_nature,
             SUM(t.amount_cents) AS total_cents
      FROM transactions t
      JOIN accounts f ON f.id = t.account_id
      JOIN accounts d ON d.id = t.counter_account_id
      WHERE t.user_id = ${userId}
        AND t.type = 'transfer'
        AND t.transaction_year = ${year}
        AND t.transaction_month = ${month}
        AND t.deleted_at IS NULL
      GROUP BY 1, 2, 3
    `);

    const cents = { saving: 0, investing: 0, debt: 0, other: 0 };
    for (const row of rows) {
      const purpose = transferPurpose(
        { nature: row.from_nature },
        { kind: row.to_kind, nature: row.to_nature },
      );
      cents[purpose] += this.toNumber(row.total_cents);
    }

    return {
      saved: cents.saving / 100,
      invested: cents.investing / 100,
      debtRepaid: cents.debt / 100,
      total: (cents.saving + cents.investing + cents.debt) / 100,
    };
  }

  async getCategoryBreakdown(userId: string, year: number, month: number) {
    this.assertMonth(month);

    const rows = await this.db.execute<CategoryBreakdownRow>(sql`
      SELECT c.name, c.color, c.icon, t.type,
        SUM(t.amount_cents) as total_cents,
        COUNT(*) as count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ${userId}
        AND t.transaction_year = ${year}
        AND t.transaction_month = ${month}
        AND t.transaction_year > 0 AND t.transaction_month > 0
        AND t.deleted_at IS NULL
      GROUP BY c.id, c.name, c.color, c.icon, t.type
      ORDER BY total_cents DESC
    `);

    return rows.map((row) => ({
      name: row.name,
      color: row.color,
      icon: row.icon,
      type: row.type,
      total: this.centsToAmount(row.total_cents),
      count: this.toNumber(row.count),
    }));
  }

  /**
   * Per-month income/expense/count for every month in [start, end] that has
   * transactions, in a single grouped query. Months without transactions are
   * absent from the map.
   */
  private async getMonthTotals(
    userId: string,
    start: YearMonth,
    end: YearMonth,
  ): Promise<Map<string, MonthTotals>> {
    // Row-value comparison keeps the range a single index scan on
    // (user_id, transaction_year, transaction_month).
    const rows = await this.db.execute<MonthlyAggregationRow>(sql`
      SELECT
        transaction_year as year,
        transaction_month as month,
        SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) as total_income_cents,
        SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) as total_expense_cents,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE user_id = ${userId}
        AND (transaction_year, transaction_month) >= (${start.year}, ${start.month})
        AND (transaction_year, transaction_month) <= (${end.year}, ${end.month})
        AND transaction_month BETWEEN 1 AND 12
        AND deleted_at IS NULL
      GROUP BY transaction_year, transaction_month
    `);

    return new Map(
      rows.map((row) => [
        this.periodKey(this.toNumber(row.year), this.toNumber(row.month)),
        {
          incomeCents: this.toNumber(row.total_income_cents),
          expenseCents: this.toNumber(row.total_expense_cents),
          count: this.toNumber(row.transaction_count),
        },
      ]),
    );
  }

  /** Totals plus a zero-filled month-by-month breakdown for one year's span. */
  private buildPeriod(
    totals: Map<string, MonthTotals>,
    year: number,
    startMonth: number,
    endMonth: number,
  ) {
    const months = Array.from(
      { length: endMonth - startMonth + 1 },
      (_value, index) => startMonth + index,
    );
    const perMonth = months.map(
      (month) => totals.get(this.periodKey(year, month)) ?? EMPTY_TOTALS,
    );

    return {
      ...this.toPeriodSummary(this.sumTotals(perMonth)),
      monthlyBreakdown: months.map((month, index) => {
        const { totalIncome, totalExpense, savings, transactionCount } =
          this.toPeriodSummary(perMonth[index]);
        return { month, totalIncome, totalExpense, savings, transactionCount };
      }),
    };
  }

  private toMonthlySummary(period: YearMonth, totals?: MonthTotals) {
    return {
      year: period.year,
      month: period.month,
      ...this.toPeriodSummary(totals ?? EMPTY_TOTALS),
    };
  }

  private toPeriodSummary(totals: MonthTotals) {
    const savingsCents = totals.incomeCents - totals.expenseCents;

    return {
      totalIncome: this.centsToAmount(totals.incomeCents),
      totalExpense: this.centsToAmount(totals.expenseCents),
      savings: this.centsToAmount(savingsCents),
      savingsRate:
        totals.incomeCents > 0
          ? ((savingsCents / totals.incomeCents) * 100).toFixed(1)
          : 0,
      transactionCount: totals.count,
    };
  }

  private sumTotals(items: Iterable<MonthTotals>): MonthTotals {
    const sum = { ...EMPTY_TOTALS };

    for (const item of items) {
      sum.incomeCents += item.incomeCents;
      sum.expenseCents += item.expenseCents;
      sum.count += item.count;
    }

    return sum;
  }

  private periodKey(year: number, month: number) {
    return `${year}-${month}`;
  }

  private monthIndex({ year, month }: YearMonth) {
    return year * 12 + (month - 1);
  }

  private centsToAmount(value: number | string | null | undefined) {
    return this.toNumber(value) / 100;
  }

  private toNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private assertMonth(month: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
  }

  private assertQuarter(quarter: number) {
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new BadRequestException('quarter must be between 1 and 4');
    }
  }
}
