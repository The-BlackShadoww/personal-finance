import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { monthlyPlans } from '../../db/schema';
import {
  availableWithRollover,
  budgetStatus,
  evaluatePlan,
  median,
  type BudgetMethod,
  type BudgetMonth,
} from './calc/plan-math';
import { UpsertPlanDto } from './dto/plan.dto';

/** Months of budget history read to follow rollover chains. */
const ROLLOVER_HISTORY_MONTHS = 12;
/** Complete months used for averages and suggestions. */
const TRAILING_MONTHS = 3;

type YearMonth = { year: number; month: number };

const toIndex = ({ year, month }: YearMonth) => year * 12 + (month - 1);
const fromIndex = (index: number): YearMonth => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});
const key = (period: YearMonth) => `${period.year}-${period.month}`;
const num = (value: number | string | null | undefined) => Number(value ?? 0);

type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  essential: boolean;
};
type BudgetRow = {
  category_id: string | null;
  year: number;
  month: number;
  amount_cents: string;
  rollover: boolean;
  id: string;
};
type SpendRow = {
  category_id: string;
  year: number;
  month: number;
  cents: string;
};

@Injectable()
export class PlanService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  /**
   * Everything the spending plan shows for a month, in one request: expected
   * income, pay-yourself-first (goals and other saving), needs and wants per
   * category with rollover, and how the plan compares with its method.
   */
  async getPlan(userId: string, year: number, month: number) {
    const current = { year, month };
    const currentIndex = toIndex(current);
    const historyStart = fromIndex(currentIndex - ROLLOVER_HISTORY_MONTHS);
    const trailing = Array.from({ length: TRAILING_MONTHS }, (_v, i) =>
      fromIndex(currentIndex - TRAILING_MONTHS + i),
    );
    const previous = fromIndex(currentIndex - 1);

    const [
      plan,
      inheritedMethod,
      categoryRows,
      budgetRows,
      spendRows,
      incomeRows,
      goalRows,
      otherSavingRows,
    ] = await Promise.all([
      this.findPlan(userId, current),
      this.inheritedMethod(userId, current),
      this.db.execute<CategoryRow>(sql`
          SELECT id, name, color, icon, essential FROM categories
          WHERE user_id = ${userId} AND type = 'expense' AND deleted_at IS NULL
          ORDER BY sort_order, name
        `),
      this.db.execute<BudgetRow>(sql`
          SELECT id, category_id, year, month, amount_cents, rollover FROM budgets
          WHERE user_id = ${userId}
            AND (year, month) >= (${historyStart.year}, ${historyStart.month})
            AND (year, month) <= (${year}, ${month})
        `),
      this.db.execute<SpendRow>(sql`
          SELECT category_id, transaction_year AS year, transaction_month AS month, SUM(amount_cents) AS cents
          FROM transactions
          WHERE user_id = ${userId} AND type = 'expense' AND deleted_at IS NULL
            AND (transaction_year, transaction_month) >= (${historyStart.year}, ${historyStart.month})
            AND (transaction_year, transaction_month) <= (${year}, ${month})
          GROUP BY 1, 2, 3
        `),
      this.db.execute<{ year: number; month: number; cents: string }>(sql`
          SELECT transaction_year AS year, transaction_month AS month, SUM(amount_cents) AS cents
          FROM transactions
          WHERE user_id = ${userId} AND type = 'income' AND deleted_at IS NULL
            AND (transaction_year, transaction_month) >= (${trailing[0].year}, ${trailing[0].month})
            AND (transaction_year, transaction_month) <= (${year}, ${month})
          GROUP BY 1, 2
        `),
      this.db.execute<{
        id: string;
        name: string;
        color: string;
        icon: string;
        funding_rule: string;
        funding_percent_bps: number | null;
        funding_amount_cents: string | null;
        actual: string | null;
      }>(sql`
          SELECT g.id, g.name, g.color, g.icon, g.funding_rule, g.funding_percent_bps, g.funding_amount_cents,
                 (SELECT SUM(c.amount_cents) FROM goal_contributions c
                  WHERE c.goal_id = g.id AND c.kind IN ('auto', 'contribution')
                    AND c.period_year = ${year} AND c.period_month = ${month}) AS actual
          FROM goals g
          WHERE g.user_id = ${userId} AND g.archived_at IS NULL
          ORDER BY g.priority, g.created_at
        `),
      // Saving, investing and debt payments not already counted as goal
      // contributions (goal-made transfers are excluded).
      this.db.execute<{ cents: string | null }>(sql`
          SELECT SUM(t.amount_cents) AS cents
          FROM transactions t
          JOIN accounts f ON f.id = t.account_id
          JOIN accounts d ON d.id = t.counter_account_id
          WHERE t.user_id = ${userId} AND t.type = 'transfer' AND t.deleted_at IS NULL
            AND t.transaction_year = ${year} AND t.transaction_month = ${month}
            AND f.nature = 'asset'
            AND (d.nature = 'liability' OR d.kind IN ('savings', 'investment', 'retirement'))
            AND NOT EXISTS (SELECT 1 FROM goal_contributions c WHERE c.transfer_transaction_id = t.id)
        `),
    ]);

    // ---- income ----
    const incomeByMonth = new Map(
      incomeRows.map((row) => [
        key({ year: Number(row.year), month: Number(row.month) }),
        num(row.cents),
      ]),
    );
    const actualIncomeCents = incomeByMonth.get(key(current)) ?? 0;
    const trailingIncome = trailing
      .map((period) => incomeByMonth.get(key(period)) ?? 0)
      .filter((cents) => cents > 0);
    const suggestedIncomeCents = trailingIncome.length
      ? Math.round(
          trailingIncome.reduce((sum, cents) => sum + cents, 0) /
            trailingIncome.length,
        )
      : null;
    const expectedIncomeCents =
      plan?.expectedIncomeCents ?? suggestedIncomeCents ?? actualIncomeCents;
    const method: BudgetMethod = plan?.method ?? inheritedMethod;

    // ---- category budgets with rollover ----
    const budgetsByCategory = new Map<string, Map<string, BudgetRow>>();
    let overall: BudgetRow | undefined;
    for (const row of budgetRows) {
      if (row.category_id === null) {
        if (Number(row.year) === year && Number(row.month) === month)
          overall = row;
        continue;
      }
      const map =
        budgetsByCategory.get(row.category_id) ?? new Map<string, BudgetRow>();
      map.set(key({ year: Number(row.year), month: Number(row.month) }), row);
      budgetsByCategory.set(row.category_id, map);
    }
    const spendByCategory = new Map<string, Map<string, number>>();
    for (const row of spendRows) {
      const map =
        spendByCategory.get(row.category_id) ?? new Map<string, number>();
      map.set(
        key({ year: Number(row.year), month: Number(row.month) }),
        num(row.cents),
      );
      spendByCategory.set(row.category_id, map);
    }

    const history = Array.from(
      { length: ROLLOVER_HISTORY_MONTHS + 1 },
      (_v, i) => fromIndex(toIndex(historyStart) + i),
    );
    const categories = categoryRows.map((category) => {
      const budgetMap = budgetsByCategory.get(category.id);
      const spendMap = spendByCategory.get(category.id);
      const months: BudgetMonth[] = history.map((period) => {
        const budget = budgetMap?.get(key(period));
        return {
          amountCents: budget ? num(budget.amount_cents) : null,
          rollover: budget?.rollover ?? false,
          spentCents: spendMap?.get(key(period)) ?? 0,
        };
      });
      const budget = budgetMap?.get(key(current));
      const { carryCents, availableCents } = availableWithRollover(months);
      const spentCents = spendMap?.get(key(current)) ?? 0;
      const trailingSpend = trailing.map(
        (period) => spendMap?.get(key(period)) ?? 0,
      );

      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        essential: category.essential,
        budgetId: budget?.id ?? null,
        amountCents: budget ? num(budget.amount_cents) : null,
        rollover: budget?.rollover ?? false,
        carryCents,
        availableCents,
        spentCents,
        remainingCents:
          availableCents === null ? null : availableCents - spentCents,
        averageCents: Math.round(
          trailingSpend.reduce((sum, cents) => sum + cents, 0) /
            TRAILING_MONTHS,
        ),
        suggestedCents: median(trailingSpend),
        status: budgetStatus(spentCents, availableCents),
      };
    });

    const group = (essential: boolean) => {
      const rows = categories.filter(
        (category) => category.essential === essential,
      );
      return {
        plannedCents: rows.reduce(
          (sum, row) => sum + (row.amountCents ?? 0),
          0,
        ),
        spentCents: rows.reduce((sum, row) => sum + row.spentCents, 0),
        categories: rows,
      };
    };
    const needs = group(true);
    const wants = group(false);

    // ---- pay yourself first ----
    const goals = goalRows.map((goal) => ({
      goalId: goal.id,
      name: goal.name,
      color: goal.color,
      icon: goal.icon,
      fundingRule: goal.funding_rule,
      plannedCents:
        goal.funding_rule === 'percent_of_income' && goal.funding_percent_bps
          ? Math.round((expectedIncomeCents * goal.funding_percent_bps) / 10000)
          : goal.funding_rule === 'fixed_monthly'
            ? num(goal.funding_amount_cents)
            : 0,
      actualCents: num(goal.actual),
    }));
    const otherSavingCents = num(otherSavingRows[0]?.cents);
    const payFirst = {
      plannedCents: goals.reduce((sum, goal) => sum + goal.plannedCents, 0),
      actualCents:
        goals.reduce((sum, goal) => sum + goal.actualCents, 0) +
        otherSavingCents,
      otherSavingCents,
      goals,
    };

    const evaluation = evaluatePlan({
      method,
      incomeCents: expectedIncomeCents,
      planned: {
        payFirst: payFirst.plannedCents,
        needs: needs.plannedCents,
        wants: wants.plannedCents,
      },
      actual: {
        payFirst: payFirst.actualCents,
        needs: needs.spentCents,
        wants: wants.spentCents,
      },
    });

    const previousHasBudgets = budgetRows.some(
      (row) =>
        Number(row.year) === previous.year &&
        Number(row.month) === previous.month,
    );

    return {
      year,
      month,
      plan: {
        id: plan?.id ?? null,
        method,
        expectedIncomeCents,
        // What the user typed; null when following the suggestion.
        expectedIncomeSetCents: plan?.expectedIncomeCents ?? null,
        suggestedIncomeCents,
        notes: plan?.notes ?? null,
      },
      income: { actualCents: actualIncomeCents },
      payFirst,
      needs,
      wants,
      overallCap: overall
        ? {
            budgetId: overall.id,
            amountCents: num(overall.amount_cents),
            spentCents: needs.spentCents + wants.spentCents,
          }
        : null,
      evaluation,
      hasBudgets: categories.some((category) => category.amountCents !== null),
      previousHasBudgets,
    };
  }

  async upsertPlan(userId: string, dto: UpsertPlanDto) {
    const expectedIncomeCents =
      dto.expectedIncome === undefined
        ? undefined
        : dto.expectedIncome === null
          ? null
          : Math.round(dto.expectedIncome * 100);

    await this.db
      .insert(monthlyPlans)
      .values({
        userId,
        year: dto.year,
        month: dto.month,
        method: dto.method ?? (await this.inheritedMethod(userId, dto)),
        expectedIncomeCents: expectedIncomeCents ?? null,
        notes: dto.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [monthlyPlans.userId, monthlyPlans.year, monthlyPlans.month],
        set: {
          method: dto.method,
          expectedIncomeCents,
          notes: dto.notes,
          updatedAt: new Date(),
        },
      });

    return this.getPlan(userId, dto.year, dto.month);
  }

  /** The method of the latest earlier plan; 50/30/20 for a first plan. */
  private async inheritedMethod(
    userId: string,
    period: YearMonth,
  ): Promise<BudgetMethod> {
    const [latest] = await this.db
      .select({ method: monthlyPlans.method })
      .from(monthlyPlans)
      .where(
        and(
          eq(monthlyPlans.userId, userId),
          sql`(${monthlyPlans.year}, ${monthlyPlans.month}) < (${period.year}, ${period.month})`,
        ),
      )
      .orderBy(desc(monthlyPlans.year), desc(monthlyPlans.month))
      .limit(1);
    return latest?.method ?? 'fifty_thirty_twenty';
  }

  private async findPlan(userId: string, period: YearMonth) {
    const [plan] = await this.db
      .select()
      .from(monthlyPlans)
      .where(
        and(
          eq(monthlyPlans.userId, userId),
          eq(monthlyPlans.year, period.year),
          eq(monthlyPlans.month, period.month),
        ),
      )
      .limit(1);
    return plan;
  }
}
