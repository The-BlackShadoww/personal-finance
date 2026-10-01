import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { alias } from 'drizzle-orm/pg-core';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  lte,
  or,
} from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { accounts, categories, transactions } from '../../db/schema';
import { AccountService } from '../account/account.service';
import { AccountsService } from '../accounts/accounts.service';
import { GoalsService, type LedgerEntry } from '../goals/goals.service';
import {
  LedgerValidator,
  type EntryShape,
} from '../ledger/ledger-validator.service';
import {
  CreateTransactionDto,
  TransactionType,
} from './dto/create-transaction.dto';
import { TransactionFiltersDto } from './dto/transaction-filters.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

const counterAccounts = alias(accounts, 'counter_account');

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountService: AccountService,
    private readonly accountsService: AccountsService,
    private readonly goalsService: GoalsService,
    private readonly ledgerValidator: LedgerValidator,
  ) {}

  /**
   * Liquid balance after a prospective entry. Only entries that move money
   * in or out of liquid accounts change it.
   */
  async getProjectedBalance(
    userId: string,
    amountCents: number,
    type: 'income' | 'expense',
    accountId?: string,
  ) {
    const [balance, account] = await Promise.all([
      this.accountService.getCurrentBalance(userId),
      accountId
        ? this.accountsService.findOwned(userId, accountId)
        : this.accountsService.getDefaultAccount(userId),
    ]);
    const affectsLiquid = account.isLiquid && account.nature === 'asset';
    const delta = affectsLiquid
      ? type === 'income'
        ? amountCents
        : -amountCents
      : 0;
    // Against money not set aside for goals.
    const projectedBalanceCents = balance.availableCents + delta;
    return {
      projectedBalanceCents,
      isLowBalance: projectedBalanceCents < balance.lowBalanceThresholdCents,
    };
  }

  async findAll(userId: string, filters: TransactionFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const where = this.buildTransactionWhere(userId, filters);

    const [data, totalRows] = await Promise.all([
      this.selectWithRelations()
        .where(where)
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(transactions).where(where),
    ]);

    return {
      data,
      total: totalRows[0]?.total ?? 0,
      page,
      limit,
    };
  }

  async findOne(userId: string, transactionId: string) {
    const transaction = await this.findOwnedTransaction(userId, transactionId);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Records an entry. An income into a spendable account is shared out to
   * goals funded from income (pay yourself first); an expense can be paid
   * from a goal. Both happen in the same database transaction.
   */
  async create(userId: string, dto: CreateTransactionDto) {
    const accountId =
      dto.accountId ??
      (await this.accountsService.getDefaultAccount(userId)).id;

    await this.ledgerValidator.assertValidShape(userId, {
      type: dto.type,
      accountId,
      counterAccountId: dto.counterAccountId ?? null,
      categoryId: dto.categoryId ?? null,
    });
    if (dto.payFromGoalId && dto.type !== TransactionType.Expense) {
      throw new BadRequestException('Only expenses can be paid from a goal');
    }

    const { id, goalAllocation, goalPayment } = await this.db.transaction(
      async (tx) => {
        const [created] = await tx
          .insert(transactions)
          .values({
            userId,
            accountId,
            counterAccountId: dto.counterAccountId ?? null,
            categoryId: dto.categoryId ?? null,
            type: dto.type,
            amountCents: Math.round(dto.amount * 100),
            date: new Date(dto.date),
            transactionMonth: dto.transactionMonth,
            transactionYear: dto.transactionYear,
            note: dto.note,
          })
          .returning();

        return {
          id: created.id,
          goalAllocation:
            created.type === 'income'
              ? await this.goalsService.allocateIncome(tx, userId, created)
              : [],
          goalPayment: dto.payFromGoalId
            ? await this.goalsService.payFromGoal(
                tx,
                userId,
                dto.payFromGoalId,
                created,
              )
            : null,
        };
      },
    );

    return { ...(await this.findOne(userId, id)), goalAllocation, goalPayment };
  }

  async update(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    const existing = await this.findOne(userId, transactionId);
    const type: EntryShape['type'] = dto.type ?? existing.type;
    const typeChanged = type !== existing.type;
    const isTransfer = type === 'transfer';

    // Fields that do not apply to the new type are cleared; fields that
    // still apply carry over unless the type family changed.
    const shape: EntryShape = {
      type,
      accountId: dto.accountId ?? existing.accountId,
      counterAccountId: isTransfer
        ? (dto.counterAccountId ?? existing.counterAccountId)
        : (dto.counterAccountId ?? null),
      categoryId: isTransfer
        ? (dto.categoryId ?? null)
        : (dto.categoryId ?? (typeChanged ? null : existing.categoryId)),
    };

    await this.ledgerValidator.assertValidShape(userId, shape, {
      // Entries may stay on an account archived after they were recorded.
      unchangedAccountIds: [
        existing.accountId,
        existing.counterAccountId,
      ].filter((id): id is string => id !== null),
    });

    const links = await this.goalsService.findLinks(
      this.db,
      userId,
      transactionId,
    );
    if (links.some((link) => link.transferTransactionId === transactionId)) {
      throw new BadRequestException(
        'This transfer was made by a goal. Delete it, or change the goal instead.',
      );
    }

    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(transactions)
        .set({
          ...shape,
          amountCents:
            dto.amount === undefined ? undefined : Math.round(dto.amount * 100),
          date: dto.date === undefined ? undefined : new Date(dto.date),
          transactionMonth: dto.transactionMonth,
          transactionYear: dto.transactionYear,
          note: dto.note,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
          ),
        )
        .returning();

      if (!updated) {
        throw new NotFoundException('Transaction not found');
      }

      // Goal links follow the edited entry: an income that was shared out
      // is shared out again; an expense paid from a goal is paid again.
      if (!links.length) return;
      const released = await this.goalsService.releaseLinked(
        tx,
        userId,
        transactionId,
      );
      const entry: LedgerEntry = updated;
      if (released.auto.length && updated.type === 'income') {
        await this.goalsService.allocateIncome(tx, userId, entry);
      }
      const paidFrom = released.withdrawals[0]?.goalId;
      if (paidFrom && updated.type === 'expense') {
        await this.goalsService.payFromGoal(tx, userId, paidFrom, entry);
      }
    });

    return this.findOne(userId, transactionId);
  }

  /** Soft-deletes an entry and anything goals did because of it. */
  async remove(userId: string, transactionId: string) {
    return this.db.transaction(async (tx) => {
      // The ownership and not-already-deleted conditions live in the WHERE
      // clause, so a single statement both checks and deletes.
      const [removed] = await tx
        .update(transactions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
          ),
        )
        .returning({ id: transactions.id });

      if (!removed) {
        throw new NotFoundException('Transaction not found');
      }

      await this.goalsService.releaseLinked(tx, userId, transactionId);
      return { success: true };
    });
  }

  async getRawTransactionsForReport(
    userId: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
  ) {
    return this.db
      .select({
        date: transactions.date,
        transactionMonth: transactions.transactionMonth,
        transactionYear: transactions.transactionYear,
        type: transactions.type,
        categoryName: categories.name,
        accountName: accounts.name,
        counterAccountName: counterAccounts.name,
        amountCents: transactions.amountCents,
        note: transactions.note,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(
        counterAccounts,
        eq(transactions.counterAccountId, counterAccounts.id),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          or(
            gt(transactions.transactionYear, startYear),
            and(
              eq(transactions.transactionYear, startYear),
              gte(transactions.transactionMonth, startMonth),
            ),
          ),
          or(
            lt(transactions.transactionYear, endYear),
            and(
              eq(transactions.transactionYear, endYear),
              lte(transactions.transactionMonth, endMonth),
            ),
          ),
          isNull(transactions.deletedAt),
        ),
      )
      .orderBy(
        asc(transactions.transactionYear),
        asc(transactions.transactionMonth),
        asc(transactions.date),
      );
  }

  private selectWithRelations() {
    return this.db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        counterAccountId: transactions.counterAccountId,
        categoryId: transactions.categoryId,
        type: transactions.type,
        amountCents: transactions.amountCents,
        date: transactions.date,
        transactionMonth: transactions.transactionMonth,
        transactionYear: transactions.transactionYear,
        note: transactions.note,
        // Set when a recurring rule posted this entry.
        recurringRuleId: transactions.recurringRuleId,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        deletedAt: transactions.deletedAt,
        // Null for transfers.
        category: {
          id: categories.id,
          name: categories.name,
          type: categories.type,
          color: categories.color,
          icon: categories.icon,
        },
        account: {
          id: accounts.id,
          name: accounts.name,
          kind: accounts.kind,
          nature: accounts.nature,
          color: accounts.color,
          icon: accounts.icon,
        },
        // Null unless a transfer.
        counterAccount: {
          id: counterAccounts.id,
          name: counterAccounts.name,
          kind: counterAccounts.kind,
          nature: counterAccounts.nature,
          color: counterAccounts.color,
          icon: counterAccounts.icon,
        },
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(
        counterAccounts,
        eq(transactions.counterAccountId, counterAccounts.id),
      );
  }

  private buildTransactionWhere(
    userId: string,
    filters: TransactionFiltersDto,
  ) {
    const clauses = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ];

    if (filters.startDate) {
      clauses.push(gte(transactions.date, new Date(filters.startDate)));
    }

    if (filters.year !== undefined) {
      clauses.push(eq(transactions.transactionYear, filters.year));
    }

    if (filters.month !== undefined) {
      clauses.push(eq(transactions.transactionMonth, filters.month));
    }

    if (filters.endDate) {
      clauses.push(lte(transactions.date, new Date(filters.endDate)));
    }

    if (filters.type) {
      clauses.push(eq(transactions.type, filters.type));
    }

    if (filters.categoryId) {
      clauses.push(eq(transactions.categoryId, filters.categoryId));
    }

    if (filters.accountId) {
      clauses.push(
        or(
          eq(transactions.accountId, filters.accountId),
          eq(transactions.counterAccountId, filters.accountId),
        )!,
      );
    }

    return and(...clauses);
  }

  private async findOwnedTransaction(userId: string, transactionId: string) {
    const [transaction] = await this.selectWithRelations()
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .limit(1);

    return transaction;
  }
}
