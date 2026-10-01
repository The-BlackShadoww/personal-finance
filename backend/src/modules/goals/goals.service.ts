import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { currentYearMonth, todayIso } from '../../common/time/timezone';
import {
  DB_TOKEN,
  type DbExecutor,
  type DrizzleDB,
} from '../../db/db.constants';
import {
  categories,
  financialProfiles,
  goalContributions,
  goals,
  transactions,
} from '../../db/schema';
import { AccountsService } from '../accounts/accounts.service';
import {
  allocateIncome,
  averageMonthlyEssential,
  defaultEmergencyMonths,
  effectiveTargetDate,
  goalProgress,
} from './calc/goal-math';
import {
  ContributeDto,
  CreateGoalDto,
  UpdateGoalDto,
  WithdrawDto,
} from './dto/goal.dto';

type GoalRow = typeof goals.$inferSelect;
type YearMonth = { year: number; month: number };

/** Complete months used to average essential spending. */
const ESSENTIAL_WINDOW_MONTHS = 6;
/** Contributions in this many days set a goal's monthly pace. */
const PACE_WINDOW_DAYS = 90;

const toCents = (amount: number) => Math.round(amount * 100);

/** An income or expense as the goal hooks need it. */
export type LedgerEntry = {
  id: string;
  accountId: string;
  amountCents: number;
  date: Date;
  transactionYear: number;
  transactionMonth: number;
};

export type GoalAllocation = {
  goalId: string;
  name: string;
  amountCents: number;
};

@Injectable()
export class GoalsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountsService: AccountsService,
  ) {}

  /** Goals with balances, progress and the emergency-fund sizing, plus totals. */
  async list(userId: string, timezone: string, includeArchived = false) {
    await this.ensureEmergencyGoal(userId);
    const today = currentYearMonth(timezone);
    const since = new Date(Date.now() - PACE_WINDOW_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const [rows, sums, { accounts }, averageEssential, stability] =
      await Promise.all([
        this.db
          .select()
          .from(goals)
          .where(eq(goals.userId, userId))
          .orderBy(asc(goals.priority), asc(goals.createdAt)),
        this.db.execute<{
          goal_id: string;
          balance: string;
          recent: string;
        }>(sql`
        SELECT goal_id,
               SUM(amount_cents) AS balance,
               COALESCE(SUM(amount_cents) FILTER (
                 WHERE kind IN ('contribution', 'auto') AND date >= ${since}
               ), 0) AS recent
        FROM goal_contributions WHERE user_id = ${userId}
        GROUP BY goal_id
      `),
        this.accountsService.getBalances(userId),
        this.averageEssentialMonthly(this.db, userId, today),
        this.incomeStability(userId),
      ]);

    const sumByGoal = new Map(
      sums.map((row) => [
        row.goal_id,
        { balance: Number(row.balance), recent: Number(row.recent) },
      ]),
    );
    const accountById = new Map(
      accounts.map((account) => [account.id, account]),
    );

    const views = rows.map((goal) => {
      const balanceCents = sumByGoal.get(goal.id)?.balance ?? 0;
      const paceMonthlyCents = Math.round(
        ((sumByGoal.get(goal.id)?.recent ?? 0) * 30) / PACE_WINDOW_DAYS,
      );
      const account = accountById.get(goal.accountId);
      const targetMonths =
        goal.targetMonths ?? defaultEmergencyMonths(stability);
      const isEmergency = goal.kind === 'emergency';
      const targetAmountCents = isEmergency
        ? averageEssential === null
          ? null
          : averageEssential * targetMonths
        : goal.targetAmountCents;
      const targetDate = isEmergency
        ? null
        : effectiveTargetDate(goal.targetDate, goal.repeatsYearly, today);

      return {
        ...goal,
        targetAmountCents,
        targetDate,
        balanceCents,
        paceMonthlyCents,
        account: account
          ? {
              id: account.id,
              name: account.name,
              kind: account.kind,
              isLiquid: account.isLiquid,
            }
          : null,
        progress: goalProgress({
          balanceCents,
          targetCents: targetAmountCents,
          targetDate,
          paceMonthlyCents,
          today,
        }),
        emergency: isEmergency
          ? {
              targetMonths,
              // Null when the user has not chosen; follows the financial profile.
              targetMonthsSetting: goal.targetMonths,
              averageEssentialMonthlyCents: averageEssential,
              monthsOfCover:
                averageEssential && averageEssential > 0
                  ? Math.round((balanceCents / averageEssential) * 10) / 10
                  : null,
              // A one-month starter buffer comes before the full fund.
              starterTargetCents: averageEssential,
            }
          : null,
      };
    });

    return {
      goals: includeArchived
        ? views
        : views.filter((goal) => goal.archivedAt === null),
      summary: this.summarize(views, accounts, averageEssential),
    };
  }

  /** Cheap per-goal balances and totals for the account summary. */
  async getEarmarks(userId: string) {
    const [rows, { accounts }] = await Promise.all([
      this.db.execute<{
        id: string;
        name: string;
        kind: string;
        color: string;
        icon: string;
        account_id: string;
        target_amount_cents: string | null;
        balance: string | null;
      }>(sql`
        SELECT g.id, g.name, g.kind, g.color, g.icon, g.account_id, g.target_amount_cents,
               (SELECT SUM(c.amount_cents) FROM goal_contributions c WHERE c.goal_id = g.id) AS balance
        FROM goals g
        WHERE g.user_id = ${userId} AND g.archived_at IS NULL
        ORDER BY g.priority, g.created_at
      `),
      this.accountsService.getBalances(userId),
    ]);

    const liquid = new Set(
      accounts
        .filter((a) => a.isLiquid && a.nature === 'asset')
        .map((a) => a.id),
    );
    const list = rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      color: row.color,
      icon: row.icon,
      accountId: row.account_id,
      targetAmountCents:
        row.target_amount_cents === null
          ? null
          : Number(row.target_amount_cents),
      balanceCents: Number(row.balance ?? 0),
    }));

    return {
      goals: list,
      /** Earmarked money sitting in liquid accounts: not available to spend. */
      earmarkedLiquidCents: list
        .filter((goal) => liquid.has(goal.accountId))
        .reduce((sum, goal) => sum + goal.balanceCents, 0),
    };
  }

  async create(userId: string, dto: CreateGoalDto) {
    await this.assertNameAvailable(userId, dto.name);
    await this.assertGoalAccount(userId, dto.accountId);
    const funding = this.fundingFields(dto.fundingRule ?? 'manual', dto);
    const categoryId = await this.resolveCategory(
      userId,
      dto.kind,
      dto.categoryId,
    );

    const [{ next }] = await this.db.execute<{ next: number }>(sql`
      SELECT COALESCE(MAX(priority), -1) + 1 AS next FROM goals WHERE user_id = ${userId}
    `);

    const [created] = await this.db
      .insert(goals)
      .values({
        userId,
        name: dto.name,
        kind: dto.kind,
        accountId: dto.accountId,
        targetAmountCents: dto.targetAmount ? toCents(dto.targetAmount) : null,
        targetDate: dto.targetDate ? dto.targetDate.slice(0, 10) : null,
        repeatsYearly:
          dto.kind === 'sinking' ? (dto.repeatsYearly ?? false) : false,
        categoryId,
        priority: Number(next),
        ...funding,
        color: dto.color,
        icon: dto.icon,
      })
      .returning();
    return created;
  }

  async update(userId: string, goalId: string, dto: UpdateGoalDto) {
    const existing = await this.findOwned(userId, goalId);
    const isEmergency = existing.kind === 'emergency';

    if (dto.kind !== undefined && dto.kind !== existing.kind) {
      throw new BadRequestException("A goal's type cannot change");
    }
    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(userId, dto.name, goalId);
    }
    if (dto.accountId !== undefined && dto.accountId !== existing.accountId) {
      await this.assertGoalAccount(userId, dto.accountId);
    }
    if (!isEmergency && dto.targetMonths !== undefined) {
      throw new BadRequestException(
        'targetMonths applies to the emergency fund only',
      );
    }

    const rule = dto.fundingRule ?? existing.fundingRule;
    const funding = this.fundingFields(rule, {
      fundingPercent:
        dto.fundingPercent !== undefined
          ? dto.fundingPercent
          : existing.fundingPercentBps === null
            ? null
            : existing.fundingPercentBps / 100,
      fundingAmount:
        dto.fundingAmount !== undefined
          ? dto.fundingAmount
          : existing.fundingAmountCents === null
            ? null
            : existing.fundingAmountCents / 100,
    });
    const categoryId =
      dto.categoryId === undefined
        ? undefined
        : await this.resolveCategory(userId, existing.kind, dto.categoryId);

    const [updated] = await this.db
      .update(goals)
      .set({
        name: dto.name,
        accountId: dto.accountId,
        targetAmountCents: isEmergency
          ? undefined
          : dto.targetAmount === undefined
            ? undefined
            : dto.targetAmount === null
              ? null
              : toCents(dto.targetAmount),
        targetDate: isEmergency
          ? undefined
          : dto.targetDate === undefined
            ? undefined
            : dto.targetDate === null
              ? null
              : dto.targetDate.slice(0, 10),
        targetMonths: isEmergency ? dto.targetMonths : undefined,
        repeatsYearly:
          existing.kind === 'sinking' ? dto.repeatsYearly : undefined,
        categoryId,
        ...funding,
        color: dto.color,
        icon: dto.icon,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goalId))
      .returning();
    return updated;
  }

  async archive(userId: string, goalId: string) {
    const goal = await this.findOwned(userId, goalId);
    if (goal.kind === 'emergency') {
      throw new BadRequestException('The emergency fund cannot be archived');
    }
    const [archived] = await this.db
      .update(goals)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(goals.id, goalId))
      .returning();
    return archived;
  }

  async restore(userId: string, goalId: string) {
    await this.findOwned(userId, goalId);
    const [restored] = await this.db
      .update(goals)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(goals.id, goalId))
      .returning();
    return restored;
  }

  /** Deletes a goal; money earmarked for it becomes available again. */
  async remove(userId: string, goalId: string) {
    const goal = await this.findOwned(userId, goalId);
    if (goal.kind === 'emergency') {
      throw new BadRequestException('The emergency fund cannot be deleted');
    }
    await this.db.delete(goals).where(eq(goals.id, goalId));
    return { success: true };
  }

  /** Sets the order income is shared out in. */
  async reorder(userId: string, ids: string[]) {
    const owned = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.userId, userId), inArray(goals.id, ids)));
    if (owned.length !== new Set(ids).size) {
      throw new NotFoundException('Goal not found');
    }

    await this.db.transaction(async (tx) => {
      for (const [priority, id] of ids.entries()) {
        await tx.update(goals).set({ priority }).where(eq(goals.id, id));
      }
    });
    return { success: true };
  }

  /**
   * Adds money to a goal. Money from another account is moved into the
   * goal's account with a transfer; money already there is earmarked.
   */
  async contribute(
    userId: string,
    timezone: string,
    goalId: string,
    dto: ContributeDto,
  ) {
    const goal = await this.findActiveGoal(userId, goalId);
    const amountCents = toCents(dto.amount);
    const fromAccountId = dto.fromAccountId ?? goal.accountId;
    const moving = fromAccountId !== goal.accountId;
    if (moving) await this.accountsService.findActive(userId, fromAccountId);

    const free = await this.freeInAccount(userId, goal.accountId);
    const available = free.freeCents + (moving ? amountCents : 0);
    if (amountCents > available) {
      throw new BadRequestException(
        `Only ${(Math.max(0, free.freeCents) / 100).toFixed(2)} in "${free.accountName}" is not already set aside. ` +
          'Add money from another account to move more in.',
      );
    }

    const date = todayIso(timezone);
    const period = currentYearMonth(timezone);
    return this.db.transaction(async (tx) => {
      const transferId = moving
        ? await this.insertTransfer(tx, userId, {
            from: fromAccountId,
            to: goal.accountId,
            amountCents,
            date: new Date(date),
            period,
            note: `Set aside for ${goal.name}`,
          })
        : null;

      const [contribution] = await tx
        .insert(goalContributions)
        .values({
          goalId,
          userId,
          amountCents,
          kind: 'contribution',
          transferTransactionId: transferId,
          note: dto.note,
          date,
          periodYear: period.year,
          periodMonth: period.month,
        })
        .returning();
      return contribution;
    });
  }

  /** Takes money out of a goal; it stays in the account, now available. */
  async withdraw(
    userId: string,
    timezone: string,
    goalId: string,
    dto: WithdrawDto,
  ) {
    const goal = await this.findOwned(userId, goalId);
    const amountCents = toCents(dto.amount);
    const balance = await this.goalBalance(this.db, goalId);
    if (amountCents > balance) {
      throw new BadRequestException(
        `${goal.name} holds ${(balance / 100).toFixed(2)}`,
      );
    }

    const period = currentYearMonth(timezone);
    const [withdrawal] = await this.db
      .insert(goalContributions)
      .values({
        goalId,
        userId,
        amountCents: -amountCents,
        kind: 'withdrawal',
        reason: dto.reason,
        note: dto.note,
        date: todayIso(timezone),
        periodYear: period.year,
        periodMonth: period.month,
      })
      .returning();
    return withdrawal;
  }

  /** Undoes the automatic set-aside from an income (and any money it moved). */
  async undoAllocation(userId: string, transactionId: string) {
    return this.db.transaction(async (tx) => {
      const released = await this.releaseLinked(tx, userId, transactionId, [
        'auto',
      ]);
      return { released: released.auto.length };
    });
  }

  // ---- Hooks run inside the transactions service's database transaction ----

  /**
   * Pay yourself first: shares a new income out to goals funded by a percent
   * of income or a fixed monthly amount, in priority order. Only income into
   * a spendable account is shared out.
   */
  async allocateIncome(
    tx: DbExecutor,
    userId: string,
    income: LedgerEntry,
  ): Promise<GoalAllocation[]> {
    const { accounts } = await this.accountsService.getBalances(userId);
    const incomeAccount = accounts.find(
      (account) => account.id === income.accountId,
    );
    if (
      !incomeAccount ||
      !incomeAccount.isLiquid ||
      incomeAccount.nature !== 'asset'
    ) {
      return [];
    }
    const activeAccounts = new Set(
      accounts
        .filter((a) => a.archivedAt === null && a.nature === 'asset')
        .map((a) => a.id),
    );

    const funded = (
      await tx
        .select()
        .from(goals)
        .where(
          and(
            eq(goals.userId, userId),
            isNull(goals.archivedAt),
            ne(goals.fundingRule, 'manual'),
          ),
        )
        .orderBy(asc(goals.priority), asc(goals.createdAt))
    ).filter((goal) => activeAccounts.has(goal.accountId));
    if (!funded.length) return [];

    const period = {
      year: income.transactionYear,
      month: income.transactionMonth,
    };
    const [sums, averageEssential, stability] = await Promise.all([
      tx.execute<{
        goal_id: string;
        balance: string;
        auto_this_period: string;
      }>(sql`
        SELECT goal_id, SUM(amount_cents) AS balance,
               COALESCE(SUM(amount_cents) FILTER (
                 WHERE kind = 'auto' AND period_year = ${period.year} AND period_month = ${period.month}
               ), 0) AS auto_this_period
        FROM goal_contributions
        WHERE user_id = ${userId}
        GROUP BY goal_id
      `),
      funded.some((goal) => goal.kind === 'emergency')
        ? this.averageEssentialMonthly(tx, userId, period)
        : Promise.resolve(null),
      this.incomeStability(userId),
    ]);
    const sumByGoal = new Map(sums.map((row) => [row.goal_id, row]));

    const plan = allocateIncome(
      income.amountCents,
      funded.map((goal) => {
        const balance = Number(sumByGoal.get(goal.id)?.balance ?? 0);
        const target =
          goal.kind === 'emergency'
            ? averageEssential === null
              ? null
              : averageEssential *
                (goal.targetMonths ?? defaultEmergencyMonths(stability))
            : goal.targetAmountCents;
        return {
          id: goal.id,
          fundingRule: goal.fundingRule,
          fundingPercentBps: goal.fundingPercentBps,
          fundingAmountCents: goal.fundingAmountCents,
          remainingToTargetCents: target === null ? null : target - balance,
          autoThisPeriodCents: Number(
            sumByGoal.get(goal.id)?.auto_this_period ?? 0,
          ),
        };
      }),
    );

    const date = income.date.toISOString().slice(0, 10);
    const result: GoalAllocation[] = [];
    for (const { goalId, amountCents } of plan) {
      const goal = funded.find((g) => g.id === goalId)!;
      const transferId =
        goal.accountId === income.accountId
          ? null
          : await this.insertTransfer(tx, userId, {
              from: income.accountId,
              to: goal.accountId,
              amountCents,
              date: income.date,
              period,
              note: `Pay yourself first: ${goal.name}`,
            });

      await tx.insert(goalContributions).values({
        goalId,
        userId,
        amountCents,
        kind: 'auto',
        sourceTransactionId: income.id,
        transferTransactionId: transferId,
        date,
        periodYear: period.year,
        periodMonth: period.month,
      });
      result.push({ goalId, name: goal.name, amountCents });
    }
    return result;
  }

  /**
   * Pays an expense from a goal (typically a sinking fund): releases up to
   * the expense amount from the goal and, if the goal's money sits in
   * another account, moves it to the paying account.
   */
  async payFromGoal(
    tx: DbExecutor,
    userId: string,
    goalId: string,
    expense: LedgerEntry,
  ) {
    const goal = await this.findOwned(userId, goalId);
    if (goal.archivedAt) {
      throw new BadRequestException(`"${goal.name}" is archived`);
    }
    const balance = await this.goalBalance(tx, goalId);
    const amountCents = Math.min(balance, expense.amountCents);
    if (amountCents <= 0) return null;

    const period = {
      year: expense.transactionYear,
      month: expense.transactionMonth,
    };
    const transferId =
      goal.accountId === expense.accountId
        ? null
        : await this.insertTransfer(tx, userId, {
            from: goal.accountId,
            to: expense.accountId,
            amountCents,
            date: expense.date,
            period,
            note: `Paid from ${goal.name}`,
          });

    await tx.insert(goalContributions).values({
      goalId,
      userId,
      amountCents: -amountCents,
      kind: 'withdrawal',
      reason: 'planned_purchase',
      sourceTransactionId: expense.id,
      transferTransactionId: transferId,
      date: expense.date.toISOString().slice(0, 10),
      periodYear: period.year,
      periodMonth: period.month,
    });
    return { goalId, name: goal.name, amountCents };
  }

  /** Goal contributions tied to a ledger entry, as its source or as its transfer. */
  async findLinks(executor: DbExecutor, userId: string, transactionId: string) {
    return executor
      .select()
      .from(goalContributions)
      .where(
        and(
          eq(goalContributions.userId, userId),
          or(
            eq(goalContributions.sourceTransactionId, transactionId),
            eq(goalContributions.transferTransactionId, transactionId),
          ),
        ),
      );
  }

  /**
   * Removes contributions tied to a ledger entry and soft-deletes the
   * transfers they created. Returns what was removed so callers can redo it.
   */
  async releaseLinked(
    tx: DbExecutor,
    userId: string,
    transactionId: string,
    kinds: Array<'auto' | 'withdrawal'> = ['auto', 'withdrawal'],
  ) {
    const links = (await this.findLinks(tx, userId, transactionId)).filter(
      (link) =>
        link.transferTransactionId === transactionId ||
        kinds.includes(link.kind as 'auto' | 'withdrawal'),
    );
    if (!links.length) return { auto: [], withdrawals: [] };

    await tx.delete(goalContributions).where(
      inArray(
        goalContributions.id,
        links.map((link) => link.id),
      ),
    );
    const transferIds = links
      .map((link) => link.transferTransactionId)
      .filter((id): id is string => id !== null && id !== transactionId);
    if (transferIds.length) {
      await tx
        .update(transactions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(inArray(transactions.id, transferIds));
    }

    return {
      auto: links.filter((link) => link.kind === 'auto'),
      withdrawals: links.filter((link) => link.kind === 'withdrawal'),
    };
  }

  // ---- helpers ----

  private summarize(
    views: Array<{
      accountId: string;
      balanceCents: number;
      archivedAt: Date | null;
    }>,
    accounts: Array<{
      id: string;
      name: string;
      balanceCents: number;
      isLiquid: boolean;
      nature: string;
    }>,
    averageEssential: number | null,
  ) {
    const earmarkedByAccount = new Map<string, number>();
    for (const goal of views) {
      earmarkedByAccount.set(
        goal.accountId,
        (earmarkedByAccount.get(goal.accountId) ?? 0) + goal.balanceCents,
      );
    }
    const liquid = accounts.filter((a) => a.isLiquid && a.nature === 'asset');
    const liquidCents = liquid.reduce((sum, a) => sum + a.balanceCents, 0);
    const earmarkedLiquidCents = liquid.reduce(
      (sum, a) => sum + (earmarkedByAccount.get(a.id) ?? 0),
      0,
    );

    return {
      earmarkedCents: views.reduce((sum, goal) => sum + goal.balanceCents, 0),
      liquidCents,
      availableCents: liquidCents - earmarkedLiquidCents,
      averageEssentialMonthlyCents: averageEssential,
      // Goals claiming more than the account holds, e.g. after spending
      // from a savings account without withdrawing from its goals.
      shortfalls: accounts
        .map((account) => ({
          accountId: account.id,
          accountName: account.name,
          shortfallCents:
            (earmarkedByAccount.get(account.id) ?? 0) -
            Math.max(0, account.balanceCents),
        }))
        .filter((row) => row.shortfallCents > 0),
    };
  }

  private async ensureEmergencyGoal(userId: string) {
    const [existing] = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.kind, 'emergency')))
      .limit(1);
    if (existing) return;

    // Prefer a savings account; otherwise the default account.
    const { accounts } = await this.accountsService.getBalances(userId);
    const active = accounts.filter(
      (a) => a.archivedAt === null && a.nature === 'asset',
    );
    const home =
      active.find((a) => a.kind === 'savings') ??
      active.find((a) => a.isDefault) ??
      (await this.accountsService.getDefaultAccount(userId));

    for (const name of ['Emergency fund', 'Emergency fund (auto)']) {
      const inserted = await this.db
        .insert(goals)
        .values({
          userId,
          name,
          kind: 'emergency',
          accountId: home.id,
          priority: -1,
          color: '#dc2626',
          icon: 'shield',
        })
        .onConflictDoNothing()
        .returning({ id: goals.id });
      if (inserted.length) return;
      const [created] = await this.db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.kind, 'emergency')))
        .limit(1);
      if (created) return;
    }
  }

  /**
   * Average monthly spending on essential categories over the complete
   * billing months before `reference`.
   */
  private async averageEssentialMonthly(
    executor: DbExecutor,
    userId: string,
    reference: YearMonth,
  ) {
    const end = reference.year * 12 + (reference.month - 1) - 1;
    const start = end - (ESSENTIAL_WINDOW_MONTHS - 1);
    const at = (index: number) => ({
      year: Math.floor(index / 12),
      month: (index % 12) + 1,
    });
    const first = at(start);
    const last = at(end);

    const rows = await executor.execute<{
      year: number;
      month: number;
      cents: string;
    }>(sql`
      SELECT t.transaction_year AS year, t.transaction_month AS month, SUM(t.amount_cents) AS cents
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId} AND t.type = 'expense' AND c.essential AND t.deleted_at IS NULL
        AND (t.transaction_year, t.transaction_month) >= (${first.year}, ${first.month})
        AND (t.transaction_year, t.transaction_month) <= (${last.year}, ${last.month})
      GROUP BY 1, 2
    `);
    const byMonth = new Map(
      rows.map((row) => [
        `${Number(row.year)}-${Number(row.month)}`,
        Number(row.cents),
      ]),
    );
    const months = Array.from({ length: ESSENTIAL_WINDOW_MONTHS }, (_v, i) =>
      at(start + i),
    );
    return averageMonthlyEssential(
      months.map(({ year, month }) => byMonth.get(`${year}-${month}`) ?? 0),
    );
  }

  private async incomeStability(userId: string) {
    const [profile] = await this.db
      .select({ incomeStability: financialProfiles.incomeStability })
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    return profile?.incomeStability ?? null;
  }

  private async goalBalance(executor: DbExecutor, goalId: string) {
    const [row] = await executor.execute<{ balance: string | null }>(sql`
      SELECT SUM(amount_cents) AS balance FROM goal_contributions WHERE goal_id = ${goalId}
    `);
    return Number(row?.balance ?? 0);
  }

  /** Money in an account not already set aside for any goal. */
  private async freeInAccount(userId: string, accountId: string) {
    const [{ accounts }, [row]] = await Promise.all([
      this.accountsService.getBalances(userId),
      this.db.execute<{ earmarked: string | null }>(sql`
        SELECT SUM(c.amount_cents) AS earmarked
        FROM goal_contributions c JOIN goals g ON g.id = c.goal_id
        WHERE g.user_id = ${userId} AND g.account_id = ${accountId}
      `),
    ]);
    const account = accounts.find((a) => a.id === accountId)!;
    return {
      accountName: account.name,
      freeCents: account.balanceCents - Number(row?.earmarked ?? 0),
    };
  }

  private async insertTransfer(
    tx: DbExecutor,
    userId: string,
    transfer: {
      from: string;
      to: string;
      amountCents: number;
      date: Date;
      period: YearMonth;
      note: string;
    },
  ) {
    const [created] = await tx
      .insert(transactions)
      .values({
        userId,
        type: 'transfer',
        accountId: transfer.from,
        counterAccountId: transfer.to,
        amountCents: transfer.amountCents,
        date: transfer.date,
        transactionYear: transfer.period.year,
        transactionMonth: transfer.period.month,
        note: transfer.note.slice(0, 500),
      })
      .returning({ id: transactions.id });
    return created.id;
  }

  private fundingFields(
    rule: 'percent_of_income' | 'fixed_monthly' | 'manual',
    values: { fundingPercent?: number | null; fundingAmount?: number | null },
  ) {
    if (rule === 'percent_of_income') {
      if (!values.fundingPercent) {
        throw new BadRequestException(
          'Set the percent of each income to put aside',
        );
      }
      return {
        fundingRule: rule,
        fundingPercentBps: Math.round(values.fundingPercent * 100),
        fundingAmountCents: null,
      };
    }
    if (rule === 'fixed_monthly') {
      if (!values.fundingAmount) {
        throw new BadRequestException('Set the amount to put aside each month');
      }
      return {
        fundingRule: rule,
        fundingPercentBps: null,
        fundingAmountCents: toCents(values.fundingAmount),
      };
    }
    return {
      fundingRule: rule,
      fundingPercentBps: null,
      fundingAmountCents: null,
    };
  }

  private async resolveCategory(
    userId: string,
    kind: GoalRow['kind'],
    categoryId: string | null | undefined,
  ) {
    if (!categoryId) return null;
    if (kind !== 'sinking') {
      throw new BadRequestException(
        'Only sinking funds can be linked to a spending category',
      );
    }
    const [category] = await this.db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    if (!category) throw new NotFoundException('Category not found');
    if (category.type !== 'expense') {
      throw new BadRequestException(
        'Link a sinking fund to an expense category',
      );
    }
    return categoryId;
  }

  private async assertGoalAccount(userId: string, accountId: string) {
    const account = await this.accountsService.findActive(userId, accountId);
    if (account.nature !== 'asset') {
      throw new BadRequestException(
        'Keep goal money in an account you own, not a card or loan',
      );
    }
  }

  private async assertNameAvailable(
    userId: string,
    name: string,
    exceptId?: string,
  ) {
    const [clash] = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.name, name),
          exceptId ? ne(goals.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (clash)
      throw new BadRequestException(`You already have a goal named "${name}"`);
  }

  private async findActiveGoal(userId: string, goalId: string) {
    const goal = await this.findOwned(userId, goalId);
    if (goal.archivedAt) {
      throw new BadRequestException(
        `"${goal.name}" is archived. Restore it to add money.`,
      );
    }
    return goal;
  }

  async findOwned(userId: string, goalId: string): Promise<GoalRow> {
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }
}
