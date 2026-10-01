import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { budgets, categories, transactions } from '../../db/schema';
import { CalculationsService } from '../calculations/calculations.service';
import { BulkBudgetsDto } from './dto/plan.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

type CategoryExpenseRow = {
  category_id: string;
  total_cents: number | string | null;
};

@Injectable()
export class BudgetsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly calculationsService: CalculationsService,
  ) {}

  async upsert(userId: string, dto: UpsertBudgetDto) {
    const categoryId = dto.categoryId ?? null;

    if (categoryId) {
      await this.assertOwnedCategory(userId, categoryId);
    }

    const [budget] = await this.db
      .insert(budgets)
      .values({
        userId,
        categoryId,
        year: dto.year,
        month: dto.month,
        amountCents: Math.round(dto.amount * 100),
        rollover: dto.rollover ?? false,
      })
      .onConflictDoUpdate({
        target: [
          budgets.userId,
          budgets.year,
          budgets.month,
          budgets.categoryId,
        ],
        set: {
          amountCents: Math.round(dto.amount * 100),
          rollover: dto.rollover,
          updatedAt: new Date(),
        },
      })
      .returning();

    return budget;
  }

  /**
   * Saves several category budgets for a month at once (a plan edit, a
   * reallocation between categories, or applying suggestions). A null
   * amount removes that category's budget.
   */
  async bulkUpsert(userId: string, dto: BulkBudgetsDto) {
    const ids = [...new Set(dto.items.map((item) => item.categoryId))];
    if (ids.length) {
      const owned = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.type, 'expense'),
            isNull(categories.deletedAt),
            inArray(categories.id, ids),
          ),
        );
      if (owned.length !== ids.length) {
        throw new NotFoundException('Expense category not found');
      }
    }

    await this.db.transaction(async (tx) => {
      for (const item of dto.items) {
        const period = and(
          eq(budgets.userId, userId),
          eq(budgets.year, dto.year),
          eq(budgets.month, dto.month),
          eq(budgets.categoryId, item.categoryId),
        );
        if (item.amount === null) {
          await tx.delete(budgets).where(period);
          continue;
        }
        const amountCents = Math.round(item.amount * 100);
        await tx
          .insert(budgets)
          .values({
            userId,
            categoryId: item.categoryId,
            year: dto.year,
            month: dto.month,
            amountCents,
            rollover: item.rollover ?? false,
          })
          .onConflictDoUpdate({
            target: [budgets.userId, budgets.year, budgets.month, budgets.categoryId],
            set: { amountCents, rollover: item.rollover, updatedAt: new Date() },
          });
      }
    });

    return { saved: dto.items.length };
  }

  async remove(userId: string, budgetId: string) {
    const [removed] = await this.db
      .delete(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning({ id: budgets.id });
    if (!removed) throw new NotFoundException('Budget not found');
    return { success: true };
  }

  /**
   * Copies the previous month's budgets and plan into a month. Budgets the
   * month already has are kept.
   */
  async copyFromPreviousMonth(userId: string, year: number, month: number) {
    const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

    return this.db.transaction(async (tx) => {
      const copied = await tx.execute<{ id: string }>(sql`
        INSERT INTO budgets (user_id, category_id, year, month, amount_cents, rollover)
        SELECT user_id, category_id, ${year}, ${month}, amount_cents, rollover
        FROM budgets
        WHERE user_id = ${userId} AND year = ${previous.year} AND month = ${previous.month}
        ON CONFLICT ON CONSTRAINT budgets_user_year_month_category_idx DO NOTHING
        RETURNING id
      `);

      await tx.execute(sql`
        INSERT INTO monthly_plans (user_id, year, month, expected_income_cents, method, notes)
        SELECT user_id, ${year}, ${month}, expected_income_cents, method, NULL
        FROM monthly_plans
        WHERE user_id = ${userId} AND year = ${previous.year} AND month = ${previous.month}
        ON CONFLICT (user_id, year, month) DO NOTHING
      `);

      return { copied: copied.length, from: previous };
    });
  }

  async getMonthlyBudgetStatus(userId: string, year: number, month: number) {
    const userBudgets = await this.db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        amountCents: budgets.amountCents,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.year, year),
          eq(budgets.month, month),
        ),
      );

    const monthlySummary = await this.calculationsService.getMonthlySummary(
      userId,
      year,
      month,
    );
    const categoryExpenses = await this.getCategoryExpenseTotals(
      userId,
      year,
      month,
    );

    return userBudgets.map((budget) => {
      const spentCents = budget.categoryId
        ? (categoryExpenses.get(budget.categoryId) ?? 0)
        : Math.round(monthlySummary.totalExpense * 100);
      const remainingCents = budget.amountCents - spentCents;
      const percentUsed =
        budget.amountCents > 0 ? (spentCents / budget.amountCents) * 100 : 0;

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        budgetAmountCents: budget.amountCents,
        spentCents,
        remainingCents,
        percentUsed,
        isOverBudget: spentCents > budget.amountCents,
      };
    });
  }

  private async assertOwnedCategory(userId: string, categoryId: string) {
    const [category] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async getCategoryExpenseTotals(
    userId: string,
    year: number,
    month: number,
  ) {
    const rows = await this.db.execute<CategoryExpenseRow>(sql`
      SELECT category_id, SUM(amount_cents) as total_cents
      FROM ${transactions}
      WHERE user_id = ${userId}
        AND type = 'expense'
        AND transaction_year = ${year}
        AND transaction_month = ${month}
        AND transaction_year > 0 AND transaction_month > 0
        AND deleted_at IS NULL
      GROUP BY category_id
    `);

    return new Map(
      rows.map((row) => [row.category_id, this.toNumber(row.total_cents)]),
    );
  }

  private toNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
