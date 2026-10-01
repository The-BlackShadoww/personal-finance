import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { currentYearMonth } from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { financialProfiles } from '../../db/schema';
import { assessIncomeStability } from './calc/income-stability';
import { UpsertFinancialProfileDto } from './dto/upsert-financial-profile.dto';

/** Complete months of history used to judge income stability. */
const STABILITY_WINDOW_MONTHS = 6;

type MonthlyIncomeRow = {
  year: number | string;
  month: number | string;
  income_cents: number | string | null;
};

type ProfileAnswers = {
  incomeStability: 'stable' | 'variable' | null;
  dependents: number | null;
  hasHealthInsurance: boolean | null;
  hasLifeInsurance: boolean | null;
  employerMatchPercent: number | null;
};

@Injectable()
export class FinancialProfileService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async get(userId: string, timezone: string) {
    const [[row], monthlyIncome] = await Promise.all([
      this.db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, userId))
        .limit(1),
      this.getRecentMonthlyIncome(userId, timezone),
    ]);

    const profile = {
      incomeStability: row?.incomeStability ?? null,
      dependents: row?.dependents ?? null,
      hasHealthInsurance: row?.hasHealthInsurance ?? null,
      hasLifeInsurance: row?.hasLifeInsurance ?? null,
      employerMatchPercent: row?.employerMatchPercent ?? null,
      retirementAgeTarget: row?.retirementAgeTarget ?? null,
      safeWithdrawalBps: row?.safeWithdrawalBps ?? 400,
      expectedRealReturnBps: row?.expectedRealReturnBps ?? 500,
      updatedAt: row?.updatedAt ?? null,
    };

    return {
      ...profile,
      isComplete: this.isComplete(profile),
      // What the transaction history says, so the UI can suggest an answer.
      incomeAssessment: assessIncomeStability(monthlyIncome),
    };
  }

  async upsert(
    userId: string,
    timezone: string,
    dto: UpsertFinancialProfileDto,
  ) {
    // Only the fields the client sent; Drizzle drops undefined keys.
    const values = {
      incomeStability: dto.incomeStability,
      dependents: dto.dependents,
      hasHealthInsurance: dto.hasHealthInsurance,
      hasLifeInsurance: dto.hasLifeInsurance,
      employerMatchPercent: dto.employerMatchPercent,
      retirementAgeTarget: dto.retirementAgeTarget,
      safeWithdrawalBps: dto.safeWithdrawalBps,
      expectedRealReturnBps: dto.expectedRealReturnBps,
    };

    await this.db
      .insert(financialProfiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: financialProfiles.userId,
        set: { ...values, updatedAt: new Date() },
      });

    return this.get(userId, timezone);
  }

  /**
   * The questions that change advice have been answered. Life cover only
   * matters when someone depends on the user's income.
   */
  private isComplete(profile: ProfileAnswers) {
    return (
      profile.incomeStability !== null &&
      profile.dependents !== null &&
      profile.hasHealthInsurance !== null &&
      profile.employerMatchPercent !== null &&
      (profile.dependents === 0 || profile.hasLifeInsurance !== null)
    );
  }

  /**
   * Income per billing month over the last complete months, oldest first and
   * zero-filled. "Complete" is judged in the user's timezone.
   */
  private async getRecentMonthlyIncome(userId: string, timezone: string) {
    const months = this.previousMonths(timezone, STABILITY_WINDOW_MONTHS);
    const first = months[0];
    const last = months[months.length - 1];

    const rows = await this.db.execute<MonthlyIncomeRow>(sql`
      SELECT transaction_year AS year, transaction_month AS month,
             SUM(amount_cents) AS income_cents
      FROM transactions
      WHERE user_id = ${userId}
        AND type = 'income'
        AND deleted_at IS NULL
        AND (transaction_year, transaction_month) >= (${first.year}, ${first.month})
        AND (transaction_year, transaction_month) <= (${last.year}, ${last.month})
      GROUP BY transaction_year, transaction_month
    `);

    const byMonth = new Map(
      rows.map((row) => [
        `${Number(row.year)}-${Number(row.month)}`,
        Number(row.income_cents ?? 0),
      ]),
    );

    return months.map(
      ({ year, month }) => byMonth.get(`${year}-${month}`) ?? 0,
    );
  }

  /** The `count` months before the current one in `timezone`, oldest first. */
  private previousMonths(timezone: string, count: number) {
    const { year, month } = currentYearMonth(timezone);
    const current = year * 12 + (month - 1);

    return Array.from({ length: count }, (_value, index) => {
      const monthIndex = current - count + index;
      return {
        year: Math.floor(monthIndex / 12),
        month: (monthIndex % 12) + 1,
      };
    });
  }
}
