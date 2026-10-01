import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { todayIso } from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { accountValuations } from '../../db/schema';
import type { AccountKind } from './account-kinds';
import { AccountsService } from './accounts.service';
import { UpsertValuationDto } from './dto/valuation.dto';

/** Accounts whose market value can drift from what was paid in. */
export const VALUED_KINDS: readonly AccountKind[] = [
  'investment',
  'retirement',
  'property',
  'other',
];

@Injectable()
export class ValuationsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountsService: AccountsService,
  ) {}

  /** An account's valuations, newest first. */
  async list(userId: string, accountId: string) {
    await this.accountsService.findOwned(userId, accountId);
    const rows = await this.db
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.accountId, accountId))
      .orderBy(desc(accountValuations.date));
    return rows;
  }

  /** Every valuation the user has entered, by account, oldest first. */
  async allByAccount(userId: string) {
    const rows = await this.db
      .select({
        accountId: accountValuations.accountId,
        date: accountValuations.date,
        valueCents: accountValuations.valueCents,
      })
      .from(accountValuations)
      .where(eq(accountValuations.userId, userId))
      .orderBy(asc(accountValuations.date));
    const byAccount = new Map<
      string,
      Array<{ date: string; valueCents: number }>
    >();
    for (const row of rows) {
      const list = byAccount.get(row.accountId) ?? [];
      list.push({ date: row.date, valueCents: row.valueCents });
      byAccount.set(row.accountId, list);
    }
    return byAccount;
  }

  /** Records what the account was worth on a day, replacing that day's value. */
  async upsert(
    userId: string,
    timezone: string,
    accountId: string,
    dto: UpsertValuationDto,
  ) {
    const account = await this.accountsService.findOwned(userId, accountId);
    if (!VALUED_KINDS.includes(account.kind)) {
      throw new BadRequestException(
        'Only investment, retirement, property and other asset accounts take valuations',
      );
    }
    if (dto.date > todayIso(timezone)) {
      throw new BadRequestException('A valuation cannot be in the future');
    }

    const valueCents = Math.round(dto.value * 100);
    const [saved] = await this.db
      .insert(accountValuations)
      .values({
        accountId,
        userId,
        date: dto.date,
        valueCents,
        note: dto.note ?? null,
      })
      .onConflictDoUpdate({
        target: [accountValuations.accountId, accountValuations.date],
        set: { valueCents, note: dto.note ?? null },
      })
      .returning();
    return saved;
  }

  async remove(userId: string, accountId: string, valuationId: string) {
    const deleted = await this.db
      .delete(accountValuations)
      .where(
        and(
          eq(accountValuations.id, valuationId),
          eq(accountValuations.accountId, accountId),
          eq(accountValuations.userId, userId),
        ),
      )
      .returning({ id: accountValuations.id });
    if (!deleted.length) throw new NotFoundException('Valuation not found');
    return { success: true };
  }
}
