import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { currentYearMonth, safeTimezone } from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { accounts, transactions } from '../../db/schema';
import { ACCOUNT_KIND_META } from './account-kinds';
import {
  balanceTrend,
  naturalBalance,
  netWorthContribution,
  trailingMonths,
  type MonthlyFlow,
} from './calc/balances';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

type AccountRow = typeof accounts.$inferSelect;

export type AccountWithBalance = AccountRow & { balanceCents: number };

export type AccountTotals = {
  /** Σ asset balances. */
  assetsCents: number;
  /** Σ liability balances (amount owed). */
  liabilitiesCents: number;
  netWorthCents: number;
  /** Σ balances of liquid asset accounts: money available to spend. */
  liquidCents: number;
};

type FlowRow = {
  account_id: string;
  month: string;
  flow_cents: number | string;
};

/** Months of month-end balances returned for each account's sparkline. */
const TREND_MONTHS = 6;

const DEFAULT_ACCOUNT = {
  name: 'Main account',
  kind: 'bank',
  nature: 'asset',
  isLiquid: true,
  icon: ACCOUNT_KIND_META.bank.icon,
  color: '#2563eb',
} as const;

const toCents = (amount: number) => Math.round(amount * 100);
const toBps = (percent: number) => Math.round(percent * 100);
const nullable = <T, R>(value: T | null | undefined, map: (v: T) => R) =>
  value === undefined ? undefined : value === null ? null : map(value);

@Injectable()
export class AccountsService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  /** Accounts with balances and a six-month balance trend, plus totals. */
  async list(userId: string, timezone: string, includeArchived = false) {
    await this.ensureDefaultAccount(userId);

    const zone = safeTimezone(timezone);
    const [rows, flows] = await Promise.all([
      this.findAll(userId),
      this.db.execute<FlowRow>(sql`
        WITH legs AS (${this.legsSql(userId)})
        SELECT account_id,
               to_char(date AT TIME ZONE ${zone}, 'YYYY-MM') AS month,
               SUM(flow_cents) AS flow_cents
        FROM legs
        GROUP BY 1, 2
      `),
    ]);

    const flowsByAccount = new Map<string, MonthlyFlow[]>();
    for (const row of flows) {
      const list = flowsByAccount.get(row.account_id) ?? [];
      list.push({ month: row.month, flowCents: Number(row.flow_cents) });
      flowsByAccount.set(row.account_id, list);
    }

    const { year, month } = currentYearMonth(zone);
    const months = trailingMonths(
      `${year}-${String(month).padStart(2, '0')}`,
      TREND_MONTHS,
    );

    const withBalances = rows.map((account) => {
      const accountFlows = flowsByAccount.get(account.id) ?? [];
      const netFlow = accountFlows.reduce(
        (sum, flow) => sum + flow.flowCents,
        0,
      );
      const balanceCents = naturalBalance(
        account.nature,
        account.openingBalanceCents,
        netFlow,
      );
      return {
        ...account,
        balanceCents,
        trend: balanceTrend(account.nature, balanceCents, accountFlows, months),
      };
    });

    return {
      accounts: includeArchived
        ? withBalances
        : withBalances.filter((account) => account.archivedAt === null),
      // Over every account: archived ones hold zero, but count them anyway.
      totals: this.totals(withBalances),
    };
  }

  /** Every account with its current balance; no trend. */
  async getBalances(userId: string): Promise<{
    accounts: AccountWithBalance[];
    totals: AccountTotals;
  }> {
    await this.ensureDefaultAccount(userId);

    const [rows, flows] = await Promise.all([
      this.findAll(userId),
      this.db.execute<{ account_id: string; flow_cents: number | string }>(sql`
        WITH legs AS (${this.legsSql(userId)})
        SELECT account_id, SUM(flow_cents) AS flow_cents FROM legs GROUP BY 1
      `),
    ]);

    const flowByAccount = new Map(
      flows.map((row) => [row.account_id, Number(row.flow_cents)]),
    );
    const withBalances = rows.map((account) => ({
      ...account,
      balanceCents: naturalBalance(
        account.nature,
        account.openingBalanceCents,
        flowByAccount.get(account.id) ?? 0,
      ),
    }));

    return { accounts: withBalances, totals: this.totals(withBalances) };
  }

  async create(userId: string, dto: CreateAccountDto) {
    await this.assertNameAvailable(userId, dto.name);
    const meta = ACCOUNT_KIND_META[dto.kind];
    const hasAccounts = (await this.findAll(userId)).length > 0;
    const makeDefault = dto.isDefault === true || !hasAccounts;

    if (makeDefault && meta.nature === 'liability') {
      throw new BadRequestException(
        'The default account must be one you spend from, not a credit card or loan',
      );
    }

    return this.db.transaction(async (tx) => {
      if (makeDefault) await this.clearDefault(tx, userId);

      const [created] = await tx
        .insert(accounts)
        .values({
          userId,
          name: dto.name,
          kind: dto.kind,
          nature: meta.nature,
          isLiquid:
            meta.nature === 'liability' ? false : (dto.isLiquid ?? meta.liquid),
          isDefault: makeDefault,
          openingBalanceCents: toCents(dto.openingBalance ?? 0),
          interestRateBps: nullable(dto.interestRate, toBps),
          minimumPaymentCents: nullable(dto.minimumPayment, toCents),
          creditLimitCents: nullable(dto.creditLimit, toCents),
          assetClass: dto.assetClass,
          expenseRatioBps: nullable(dto.expenseRatio, toBps),
          color: dto.color,
          icon: dto.icon ?? meta.icon,
          sortOrder: dto.sortOrder,
        })
        .returning();
      return created;
    });
  }

  async update(userId: string, accountId: string, dto: UpdateAccountDto) {
    const existing = await this.findOwned(userId, accountId);

    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(userId, dto.name, accountId);
    }

    const kind = dto.kind ?? existing.kind;
    const nature = ACCOUNT_KIND_META[kind].nature;
    if (nature !== existing.nature) {
      throw new BadRequestException(
        'An account cannot switch between money you own and money you owe. Create a new account instead.',
      );
    }

    if (dto.isDefault === false && existing.isDefault) {
      throw new BadRequestException(
        'Choose another account as the default instead',
      );
    }
    if (
      dto.isDefault === true &&
      (existing.archivedAt || nature === 'liability')
    ) {
      throw new BadRequestException(
        'The default account must be an active account you spend from',
      );
    }

    return this.db.transaction(async (tx) => {
      if (dto.isDefault === true && !existing.isDefault) {
        await this.clearDefault(tx, userId);
      }

      const [updated] = await tx
        .update(accounts)
        .set({
          name: dto.name,
          kind: dto.kind,
          isLiquid: nature === 'liability' ? false : dto.isLiquid,
          isDefault: dto.isDefault,
          openingBalanceCents:
            nullable(dto.openingBalance, toCents) ?? undefined,
          interestRateBps: nullable(dto.interestRate, toBps),
          minimumPaymentCents: nullable(dto.minimumPayment, toCents),
          creditLimitCents: nullable(dto.creditLimit, toCents),
          assetClass: dto.assetClass,
          expenseRatioBps: nullable(dto.expenseRatio, toBps),
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId))
        .returning();
      return updated;
    });
  }

  /**
   * Hides an account from pickers. Its balance must be zero first, so
   * archiving never makes money disappear from net worth.
   */
  async archive(userId: string, accountId: string) {
    const account = await this.findOwned(userId, accountId);
    if (account.isDefault) {
      throw new BadRequestException(
        'Choose another default account before archiving this one',
      );
    }

    const { accounts: balances } = await this.getBalances(userId);
    const balance =
      balances.find((row) => row.id === accountId)?.balanceCents ?? 0;
    if (balance !== 0) {
      throw new BadRequestException(
        'Move the remaining balance out with a transfer before archiving this account',
      );
    }

    const [archived] = await this.db
      .update(accounts)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, accountId))
      .returning();
    return archived;
  }

  async restore(userId: string, accountId: string) {
    await this.findOwned(userId, accountId);
    const [restored] = await this.db
      .update(accounts)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))
      .returning();
    return restored;
  }

  /** Deletes an account that has never been used; otherwise archive it. */
  async remove(userId: string, accountId: string) {
    const account = await this.findOwned(userId, accountId);
    if (account.isDefault) {
      throw new BadRequestException('The default account cannot be deleted');
    }

    const [used] = await this.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        or(
          eq(transactions.accountId, accountId),
          eq(transactions.counterAccountId, accountId),
        ),
      )
      .limit(1);
    if (used) {
      throw new BadRequestException(
        'This account has transactions. Archive it instead to keep your history.',
      );
    }

    await this.db.delete(accounts).where(eq(accounts.id, accountId));
    return { success: true };
  }

  /** The default account, created on first use for users who have none. */
  async getDefaultAccount(userId: string): Promise<AccountRow> {
    await this.ensureDefaultAccount(userId);
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isDefault, true)))
      .limit(1);
    return account;
  }

  /** An account the user owns that can receive new entries. */
  async findActive(userId: string, accountId: string): Promise<AccountRow> {
    const account = await this.findOwned(userId, accountId);
    if (account.archivedAt) {
      throw new BadRequestException(
        `"${account.name}" is archived. Restore it to record new transactions.`,
      );
    }
    return account;
  }

  async findOwned(userId: string, accountId: string): Promise<AccountRow> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  /** Sets the opening balance of the default account (legacy account setup). */
  async setDefaultOpeningBalance(userId: string, openingBalanceCents: number) {
    const account = await this.getDefaultAccount(userId);
    await this.db
      .update(accounts)
      .set({ openingBalanceCents, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));
  }

  /**
   * One row per side of every live entry, as cash flowing into (+) or out of
   * (−) an account. Income/expense have one side; transfers have two.
   */
  private legsSql(userId: string) {
    return sql`
      SELECT account_id, date,
             CASE WHEN type = 'income' THEN amount_cents ELSE -amount_cents END AS flow_cents
      FROM transactions
      WHERE user_id = ${userId} AND deleted_at IS NULL
      UNION ALL
      SELECT counter_account_id, date, amount_cents
      FROM transactions
      WHERE user_id = ${userId} AND deleted_at IS NULL AND type = 'transfer'
    `;
  }

  private totals(rows: AccountWithBalance[]): AccountTotals {
    const totals = {
      assetsCents: 0,
      liabilitiesCents: 0,
      netWorthCents: 0,
      liquidCents: 0,
    };
    for (const account of rows) {
      if (account.nature === 'asset')
        totals.assetsCents += account.balanceCents;
      else totals.liabilitiesCents += account.balanceCents;
      totals.netWorthCents += netWorthContribution(
        account.nature,
        account.balanceCents,
      );
      if (account.isLiquid && account.nature === 'asset') {
        totals.liquidCents += account.balanceCents;
      }
    }
    return totals;
  }

  private findAll(userId: string) {
    return this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
  }

  private async ensureDefaultAccount(userId: string) {
    const [existing] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isDefault, true)))
      .limit(1);
    if (existing) return;

    // Prefer promoting an active asset account the user already has.
    const [candidate] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.nature, 'asset'),
          isNull(accounts.archivedAt),
        ),
      )
      .orderBy(asc(accounts.createdAt))
      .limit(1);

    // The partial unique index keeps concurrent requests to one default.
    if (candidate) {
      await this.db
        .update(accounts)
        .set({ isDefault: true })
        .where(eq(accounts.id, candidate.id))
        .catch(() => undefined);
      return;
    }

    await this.db
      .insert(accounts)
      .values({ userId, ...DEFAULT_ACCOUNT, isDefault: true })
      .onConflictDoNothing();
  }

  private async clearDefault(tx: Pick<DrizzleDB, 'update'>, userId: string) {
    await tx
      .update(accounts)
      .set({ isDefault: false })
      .where(and(eq(accounts.userId, userId), eq(accounts.isDefault, true)));
  }

  private async assertNameAvailable(
    userId: string,
    name: string,
    exceptId?: string,
  ) {
    const [clash] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.name, name),
          exceptId ? ne(accounts.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (clash) {
      throw new BadRequestException(
        `You already have an account named "${name}"`,
      );
    }
  }
}
