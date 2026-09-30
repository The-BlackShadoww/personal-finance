import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gt, gte, isNull, lt, lte, or } from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { categories, transactions } from '../../db/schema';
import {
  CreateTransactionDto,
  TransactionType,
} from './dto/create-transaction.dto';
import { TransactionFiltersDto } from './dto/transaction-filters.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AccountService } from '../account/account.service';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountService: AccountService,
  ) {}

  async getProjectedBalance(userId: string, amountCents: number, type: 'income' | 'expense') {
    const balance = await this.accountService.getCurrentBalance(userId);
    const projectedBalanceCents = balance.currentBalanceCents + (type === 'income' ? amountCents : -amountCents);
    return { projectedBalanceCents, isLowBalance: projectedBalanceCents < balance.lowBalanceThresholdCents };
  }

  async findAll(userId: string, filters: TransactionFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const where = this.buildTransactionWhere(userId, filters);

    const [data, totalRows] = await Promise.all([
      this.db
        .select({
          id: transactions.id,
          userId: transactions.userId,
          categoryId: transactions.categoryId,
          type: transactions.type,
          amountCents: transactions.amountCents,
          date: transactions.date,
          transactionMonth: transactions.transactionMonth,
          transactionYear: transactions.transactionYear,
          note: transactions.note,
          createdAt: transactions.createdAt,
          updatedAt: transactions.updatedAt,
          deletedAt: transactions.deletedAt,
          category: {
            id: categories.id,
            userId: categories.userId,
            name: categories.name,
            type: categories.type,
            color: categories.color,
            icon: categories.icon,
            isDefault: categories.isDefault,
            sortOrder: categories.sortOrder,
            createdAt: categories.createdAt,
            updatedAt: categories.updatedAt,
            deletedAt: categories.deletedAt,
          },
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .where(where)
        .orderBy(desc(transactions.date))
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
    const transaction = await this.findOwnedTransactionWithCategory(
      userId,
      transactionId,
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const category = await this.findOwnedCategory(userId, dto.categoryId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    this.assertTypeMatchesCategory(dto.type, category.type);

    const [created] = await this.db
      .insert(transactions)
      .values({
        userId,
        categoryId: dto.categoryId,
        type: dto.type,
        amountCents: Math.round(dto.amount * 100),
        date: new Date(dto.date),
        transactionMonth: dto.transactionMonth,
        transactionYear: dto.transactionYear,
        note: dto.note,
      })
      .returning();

    // The category was loaded for validation above, so the response can be
    // assembled without reading the row back.
    return { ...created, category };
  }

  async update(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    const existing = await this.findOwnedTransactionWithCategory(
      userId,
      transactionId,
    );

    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    let category = existing.category;
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const newCategory = await this.findOwnedCategory(userId, dto.categoryId);

      if (!newCategory) {
        throw new NotFoundException('Category not found');
      }

      category = newCategory;
    }

    const type = dto.type ?? existing.type;
    this.assertTypeMatchesCategory(type, category.type);

    const updates: Partial<typeof transactions.$inferInsert> = {};

    if (dto.type !== undefined) {
      updates.type = dto.type;
    }

    if (dto.amount !== undefined) {
      updates.amountCents = Math.round(dto.amount * 100);
    }

    if (dto.date !== undefined) {
      updates.date = new Date(dto.date);
    }

    if (dto.transactionMonth !== undefined) {
      updates.transactionMonth = dto.transactionMonth;
    }

    if (dto.transactionYear !== undefined) {
      updates.transactionYear = dto.transactionYear;
    }

    if (dto.categoryId !== undefined) {
      updates.categoryId = dto.categoryId;
    }

    if (dto.note !== undefined) {
      updates.note = dto.note;
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const [updated] = await this.db
      .update(transactions)
      .set({ ...updates, updatedAt: new Date() })
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

    return { ...updated, category };
  }

  async remove(userId: string, transactionId: string) {
    // The ownership and not-already-deleted conditions live in the WHERE
    // clause, so a single statement both checks and deletes.
    const [removed] = await this.db
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

    return { success: true };
  }

  async getRawTransactionsForReport(
    userId: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
  ): Promise<
    Array<{
      date: Date;
      transactionMonth: number;
      transactionYear: number;
      type: 'income' | 'expense';
      categoryName: string;
      amountCents: number;
      note: string | null;
    }>
  > {
    const rows = await this.db
      .select({
        date: transactions.date,
        transactionMonth: transactions.transactionMonth,
        transactionYear: transactions.transactionYear,
        type: transactions.type,
        categoryName: categories.name,
        amountCents: transactions.amountCents,
        note: transactions.note,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          or(
            gt(transactions.transactionYear, startYear),
            and(eq(transactions.transactionYear, startYear), gte(transactions.transactionMonth, startMonth)),
          ),
          or(
            lt(transactions.transactionYear, endYear),
            and(eq(transactions.transactionYear, endYear), lte(transactions.transactionMonth, endMonth)),
          ),
          isNull(transactions.deletedAt),
        ),
      )
      .orderBy(asc(transactions.transactionYear), asc(transactions.transactionMonth), asc(transactions.date));

    return rows as Array<{
      date: Date;
      transactionMonth: number;
      transactionYear: number;
      type: 'income' | 'expense';
      categoryName: string;
      amountCents: number;
      note: string | null;
    }>;
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

    return and(...clauses);
  }

  private async findOwnedTransactionWithCategory(
    userId: string,
    transactionId: string,
  ) {
    const [transaction] = await this.db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        categoryId: transactions.categoryId,
        type: transactions.type,
        amountCents: transactions.amountCents,
        date: transactions.date,
        transactionMonth: transactions.transactionMonth,
        transactionYear: transactions.transactionYear,
        note: transactions.note,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        deletedAt: transactions.deletedAt,
        category: {
          id: categories.id,
          userId: categories.userId,
          name: categories.name,
          type: categories.type,
          color: categories.color,
          icon: categories.icon,
          isDefault: categories.isDefault,
          sortOrder: categories.sortOrder,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
          deletedAt: categories.deletedAt,
        },
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
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

  private async findOwnedCategory(userId: string, categoryId: string) {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);

    return category;
  }

  private assertTypeMatchesCategory(
    transactionType: TransactionType | 'income' | 'expense',
    categoryType: TransactionType | 'income' | 'expense',
  ) {
    if (transactionType !== categoryType) {
      throw new BadRequestException(
        'Transaction type must match category type',
      );
    }
  }
}
