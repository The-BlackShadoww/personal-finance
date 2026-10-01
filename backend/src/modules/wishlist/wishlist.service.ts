import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { currentYearMonth, safeTimezone } from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import {
  categories,
  financialProfiles,
  transactions,
  wishlistItems,
} from '../../db/schema';
import {
  CreateWishlistItemDto,
  DecideWishlistItemDto,
} from './dto/wishlist.dto';

const DEFAULT_COOLING_HOURS = 48;
/** Decided items shown in the list (the totals cover all of them). */
const RECENT_DECIDED = 20;

@Injectable()
export class WishlistService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  /** Waiting items, recent decisions, this year's totals and the settings. */
  async list(userId: string, timezone: string) {
    const zone = safeTimezone(timezone);
    const { year } = currentYearMonth(zone);
    const [pending, decided, [totals], settings] = await Promise.all([
      this.db
        .select()
        .from(wishlistItems)
        .where(
          and(
            eq(wishlistItems.userId, userId),
            eq(wishlistItems.decision, 'pending'),
          ),
        )
        .orderBy(asc(wishlistItems.coolUntil)),
      this.db
        .select()
        .from(wishlistItems)
        .where(
          and(
            eq(wishlistItems.userId, userId),
            sql`${wishlistItems.decision} <> 'pending'`,
          ),
        )
        .orderBy(desc(wishlistItems.decidedAt))
        .limit(RECENT_DECIDED),
      this.db.execute<{
        skipped_cents: string | null;
        skipped_count: string;
        bought_cents: string | null;
      }>(sql`
        SELECT SUM(amount_cents) FILTER (WHERE decision = 'skipped') AS skipped_cents,
               COUNT(*) FILTER (WHERE decision = 'skipped') AS skipped_count,
               SUM(amount_cents) FILTER (WHERE decision = 'bought') AS bought_cents
        FROM wishlist_items
        WHERE user_id = ${userId}
          AND decided_at IS NOT NULL
          AND EXTRACT(YEAR FROM decided_at AT TIME ZONE ${zone}) = ${year}
      `),
      this.getSettings(userId),
    ]);

    const now = Date.now();
    const withState = (item: typeof wishlistItems.$inferSelect) => ({
      ...item,
      ready: item.decision === 'pending' && item.coolUntil.getTime() <= now,
    });

    return {
      pending: pending.map(withState),
      decided: decided.map(withState),
      summary: {
        year,
        readyCount: pending.filter((item) => item.coolUntil.getTime() <= now)
          .length,
        waitingCents: pending.reduce((sum, item) => sum + item.amountCents, 0),
        skippedThisYearCents: Number(totals?.skipped_cents ?? 0),
        skippedThisYearCount: Number(totals?.skipped_count ?? 0),
        boughtThisYearCents: Number(totals?.bought_cents ?? 0),
      },
      settings,
    };
  }

  /** Puts a want on the list; it waits for the user's cooling-off time. */
  async create(userId: string, dto: CreateWishlistItemDto) {
    if (dto.categoryId)
      await this.assertExpenseCategory(userId, dto.categoryId);
    const { hours } = await this.getSettings(userId);
    const [created] = await this.db
      .insert(wishlistItems)
      .values({
        userId,
        name: dto.name.trim(),
        amountCents: Math.round(dto.amount * 100),
        url: dto.url ?? null,
        categoryId: dto.categoryId ?? null,
        coolUntil: new Date(Date.now() + hours * 3_600_000),
      })
      .returning();
    return created;
  }

  async decide(userId: string, itemId: string, dto: DecideWishlistItemDto) {
    const item = await this.findOwned(userId, itemId);
    if (dto.decision === 'bought' && item.coolUntil.getTime() > Date.now()) {
      throw new BadRequestException(
        `Still cooling off until ${item.coolUntil.toISOString()}. Sleep on it a little longer.`,
      );
    }
    if (dto.transactionId) {
      const [owned] = await this.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.id, dto.transactionId),
            eq(transactions.userId, userId),
          ),
        )
        .limit(1);
      if (!owned) throw new NotFoundException('Transaction not found');
    }

    const [updated] = await this.db
      .update(wishlistItems)
      .set({
        decision: dto.decision,
        decidedAt: dto.decision === 'pending' ? null : new Date(),
        transactionId:
          dto.decision === 'bought' ? (dto.transactionId ?? null) : null,
      })
      .where(eq(wishlistItems.id, item.id))
      .returning();
    return updated;
  }

  async remove(userId: string, itemId: string) {
    const item = await this.findOwned(userId, itemId);
    await this.db.delete(wishlistItems).where(eq(wishlistItems.id, item.id));
    return { success: true };
  }

  /** The cooling-off rule from the financial profile. */
  async getSettings(userId: string) {
    const [profile] = await this.db
      .select({
        thresholdCents: financialProfiles.coolingOffThresholdCents,
        hours: financialProfiles.coolingOffHours,
      })
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    return {
      /** Null when the rule is off. */
      thresholdCents: profile?.thresholdCents ?? null,
      hours: profile?.hours ?? DEFAULT_COOLING_HOURS,
    };
  }

  private async findOwned(userId: string, itemId: string) {
    const [item] = await this.db
      .select()
      .from(wishlistItems)
      .where(
        and(eq(wishlistItems.id, itemId), eq(wishlistItems.userId, userId)),
      )
      .limit(1);
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  private async assertExpenseCategory(userId: string, categoryId: string) {
    const [category] = await this.db
      .select({ type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!category) throw new NotFoundException('Category not found');
    if (category.type !== 'expense') {
      throw new BadRequestException('Choose an expense category');
    }
  }
}
