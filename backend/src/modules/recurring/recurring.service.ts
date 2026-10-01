import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { todayIso } from '../../common/time/timezone';
import {
  DB_TOKEN,
  type DbExecutor,
  type DrizzleDB,
} from '../../db/db.constants';
import {
  accounts,
  categories,
  recurringRules,
  transactions,
} from '../../db/schema';
import { AccountsService } from '../accounts/accounts.service';
import { GoalsService } from '../goals/goals.service';
import { LedgerValidator } from '../ledger/ledger-validator.service';
import {
  billingPeriod,
  monthlyEquivalent,
  nextOccurrenceAfter,
  occurrenceAt,
  occurrencesBetween,
} from './calc/recurrence';
import {
  ConfirmOccurrenceDto,
  CreateRecurringDto,
  UpdateRecurringDto,
} from './dto/recurring.dto';

type RuleRow = typeof recurringRules.$inferSelect;

/** Due rules are posted at most this often per user (requests are frequent). */
const MATERIALIZE_INTERVAL_MS = 5 * 60 * 1000;

const counterAccounts = alias(accounts, 'counter_account');

const addDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
};

/** The first occurrence on or after `from`, skipping `exclude` if given. */
function firstOccurrenceFrom(
  rule: Pick<RuleRow, 'anchorDate' | 'frequency' | 'endDate'>,
  from: string,
  exclude?: string,
) {
  const schedule = {
    anchorDate: rule.anchorDate,
    frequency: rule.frequency,
    endDate: rule.endDate,
  };
  let candidate: string | null =
    from <= rule.anchorDate
      ? rule.anchorDate
      : nextOccurrenceAfter(schedule, addDays(from, -1));
  if (candidate && candidate === exclude)
    candidate = nextOccurrenceAfter(schedule, candidate);
  return candidate;
}

@Injectable()
export class RecurringService {
  private readonly lastMaterialized = new Map<string, number>();

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountsService: AccountsService,
    private readonly goalsService: GoalsService,
    private readonly ledgerValidator: LedgerValidator,
  ) {}

  /** Rules, what is due for confirmation, the coming month and subscription totals. */
  async list(userId: string, timezone: string) {
    await this.materializeDue(userId, timezone, { force: true });
    const today = todayIso(timezone);
    // Up to the same date next month, so every monthly payment shows once.
    const horizon = occurrenceAt(today, 'monthly', 1);

    const rows = await this.db
      .select({
        rule: recurringRules,
        accountName: accounts.name,
        counterAccountName: counterAccounts.name,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
      })
      .from(recurringRules)
      .innerJoin(accounts, eq(accounts.id, recurringRules.accountId))
      .leftJoin(
        counterAccounts,
        eq(counterAccounts.id, recurringRules.counterAccountId),
      )
      .leftJoin(categories, eq(categories.id, recurringRules.categoryId))
      .where(eq(recurringRules.userId, userId))
      .orderBy(asc(recurringRules.nextDueDate), asc(recurringRules.name));

    const rules = rows.map(({ rule, ...names }) => ({
      ...rule,
      ...names,
      monthlyEquivalentCents: monthlyEquivalent(
        rule.amountCents,
        rule.frequency,
      ),
    }));
    const active = rules.filter(
      (rule) => rule.pausedAt === null && rule.nextDueDate !== null,
    );

    const upcoming = active
      .flatMap((rule) =>
        occurrencesBetween(
          {
            anchorDate: rule.anchorDate,
            frequency: rule.frequency,
            endDate: rule.endDate,
          },
          rule.nextDueDate! > today ? rule.nextDueDate! : addDays(today, 1),
          horizon,
        ).map((date) => ({
          ruleId: rule.id,
          name: rule.name,
          type: rule.type,
          amountCents: rule.amountCents,
          date,
          autoPost: rule.autoPost,
        })),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 50);

    const subscriptions = active.filter(
      (rule) => rule.isSubscription && rule.type === 'expense',
    );
    const subscriptionMonthlyCents = subscriptions.reduce(
      (sum, rule) => sum + rule.monthlyEquivalentCents,
      0,
    );

    return {
      rules,
      // Rules waiting for you to confirm or skip an occurrence.
      due: active
        .filter((rule) => !rule.autoPost && rule.nextDueDate! <= today)
        .map((rule) => ({
          ruleId: rule.id,
          name: rule.name,
          type: rule.type,
          amountCents: rule.amountCents,
          date: rule.nextDueDate!,
        })),
      upcoming,
      subscriptions: {
        count: subscriptions.length,
        monthlyCents: subscriptionMonthlyCents,
        yearlyCents: subscriptionMonthlyCents * 12,
      },
    };
  }

  /**
   * Posts every due occurrence of the user's auto-post rules up to today in
   * their timezone. Runs lazily from busy endpoints instead of a scheduler
   * (the API host may sleep); the unique (rule, occurrence) index makes
   * concurrent runs safe. Income posted this way is shared out to goals
   * like any other income: payday automation.
   */
  async materializeDue(
    userId: string,
    timezone: string,
    { force = false } = {},
  ) {
    const last = this.lastMaterialized.get(userId) ?? 0;
    if (!force && Date.now() - last < MATERIALIZE_INTERVAL_MS)
      return { posted: 0 };
    this.lastMaterialized.set(userId, Date.now());

    const today = todayIso(timezone);
    const due = await this.db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.userId, userId),
          eq(recurringRules.autoPost, true),
          isNull(recurringRules.pausedAt),
          lte(recurringRules.nextDueDate, today),
        ),
      );

    let posted = 0;
    for (const rule of due) {
      try {
        await this.ledgerValidator.assertValidShape(userId, rule);
      } catch {
        // An account was archived or a category deleted: stop rather than
        // post something wrong; the rule shows as paused.
        await this.db
          .update(recurringRules)
          .set({ pausedAt: new Date(), updatedAt: new Date() })
          .where(eq(recurringRules.id, rule.id));
        continue;
      }
      const dates = occurrencesBetween(rule, rule.nextDueDate!, today);
      for (const date of dates) {
        await this.db.transaction(async (tx) => {
          if (await this.postOccurrence(tx, rule, date, rule.amountCents))
            posted += 1;
          await tx
            .update(recurringRules)
            .set({
              nextDueDate: nextOccurrenceAfter(rule, date),
              updatedAt: new Date(),
            })
            .where(eq(recurringRules.id, rule.id));
        });
      }
    }
    return { posted };
  }

  async create(userId: string, timezone: string, dto: CreateRecurringDto) {
    const accountId =
      dto.accountId ??
      (await this.accountsService.getDefaultAccount(userId)).id;
    const shape = {
      type: dto.type,
      accountId,
      counterAccountId: dto.counterAccountId ?? null,
      categoryId: dto.categoryId ?? null,
    };
    await this.ledgerValidator.assertValidShape(userId, shape);
    this.assertScheduleFields(
      dto.type,
      dto.isSubscription,
      dto.anchorDate.slice(0, 10),
      dto.endDate,
    );

    const anchorDate = dto.anchorDate.slice(0, 10);
    const source = dto.fromTransactionId
      ? await this.findLinkableEntry(userId, dto.fromTransactionId)
      : null;
    const schedule = {
      anchorDate,
      frequency: dto.frequency,
      endDate: dto.endDate?.slice(0, 10) ?? null,
    };
    // Past occurrences are never back-filled; an entry made recurring is its first one.
    const nextDueDate = firstOccurrenceFrom(
      schedule,
      todayIso(timezone),
      source ? anchorDate : undefined,
    );

    this.lastMaterialized.delete(userId);
    return this.db.transaction(async (tx) => {
      const [rule] = await tx
        .insert(recurringRules)
        .values({
          userId,
          name: dto.name,
          ...shape,
          amountCents: Math.round(dto.amount * 100),
          note: dto.note,
          ...schedule,
          nextDueDate,
          periodOffsetMonths: dto.periodOffsetMonths ?? 0,
          autoPost: dto.autoPost ?? false,
          isSubscription: dto.isSubscription ?? false,
        })
        .returning();

      if (source) {
        await tx
          .update(transactions)
          .set({
            recurringRuleId: rule.id,
            occurrenceDate: anchorDate,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, source.id));
      }
      return rule;
    });
  }

  async update(
    userId: string,
    timezone: string,
    ruleId: string,
    dto: UpdateRecurringDto,
  ) {
    const existing = await this.findOwned(userId, ruleId);
    const type = dto.type ?? existing.type;
    const isTransfer = type === 'transfer';
    const typeChanged = type !== existing.type;
    const shape = {
      type,
      accountId: dto.accountId ?? existing.accountId,
      counterAccountId: isTransfer
        ? (dto.counterAccountId ?? existing.counterAccountId)
        : (dto.counterAccountId ?? null),
      categoryId: isTransfer
        ? (dto.categoryId ?? null)
        : (dto.categoryId ?? (typeChanged ? null : existing.categoryId)),
    };
    await this.ledgerValidator.assertValidShape(userId, shape);

    const schedule = {
      anchorDate: dto.anchorDate?.slice(0, 10) ?? existing.anchorDate,
      frequency: dto.frequency ?? existing.frequency,
      endDate:
        dto.endDate === undefined
          ? existing.endDate
          : (dto.endDate?.slice(0, 10) ?? null),
    };
    const isSubscription =
      type === 'expense'
        ? (dto.isSubscription ?? existing.isSubscription)
        : false;
    this.assertScheduleFields(
      type,
      isSubscription,
      schedule.anchorDate,
      schedule.endDate,
    );

    // A new schedule starts from today; otherwise keep the place in it.
    const scheduleChanged =
      schedule.anchorDate !== existing.anchorDate ||
      schedule.frequency !== existing.frequency ||
      schedule.endDate !== existing.endDate;
    const nextDueDate = scheduleChanged
      ? firstOccurrenceFrom(schedule, todayIso(timezone))
      : existing.nextDueDate;

    // A changed rule may be due now; let the next request post it.
    this.lastMaterialized.delete(userId);
    const [updated] = await this.db
      .update(recurringRules)
      .set({
        name: dto.name,
        ...shape,
        amountCents:
          dto.amount === undefined ? undefined : Math.round(dto.amount * 100),
        note: dto.note,
        ...schedule,
        nextDueDate,
        periodOffsetMonths: dto.periodOffsetMonths,
        autoPost: dto.autoPost,
        isSubscription,
        updatedAt: new Date(),
      })
      .where(eq(recurringRules.id, ruleId))
      .returning();
    return updated;
  }

  /** Deletes a rule; entries it already posted stay in the ledger. */
  async remove(userId: string, ruleId: string) {
    await this.findOwned(userId, ruleId);
    await this.db.delete(recurringRules).where(eq(recurringRules.id, ruleId));
    return { success: true };
  }

  async pause(userId: string, ruleId: string) {
    await this.findOwned(userId, ruleId);
    const [rule] = await this.db
      .update(recurringRules)
      .set({ pausedAt: new Date(), updatedAt: new Date() })
      .where(eq(recurringRules.id, ruleId))
      .returning();
    return rule;
  }

  /** Resumes from today: occurrences missed while paused are not posted. */
  async resume(userId: string, timezone: string, ruleId: string) {
    const rule = await this.findOwned(userId, ruleId);
    await this.ledgerValidator.assertValidShape(userId, rule);
    this.lastMaterialized.delete(userId);
    const [resumed] = await this.db
      .update(recurringRules)
      .set({
        pausedAt: null,
        nextDueDate: firstOccurrenceFrom(rule, todayIso(timezone)),
        updatedAt: new Date(),
      })
      .where(eq(recurringRules.id, ruleId))
      .returning();
    return resumed;
  }

  /** Posts the next occurrence now (optionally with a different amount). */
  async confirm(userId: string, ruleId: string, dto: ConfirmOccurrenceDto) {
    const rule = await this.findOwned(userId, ruleId);
    if (!rule.nextDueDate) throw new BadRequestException('This rule has ended');
    if (rule.pausedAt) throw new BadRequestException('Resume the rule first');
    await this.ledgerValidator.assertValidShape(userId, rule);
    const date = rule.nextDueDate;

    return this.db.transaction(async (tx) => {
      const created = await this.postOccurrence(
        tx,
        rule,
        date,
        dto.amount ? Math.round(dto.amount * 100) : rule.amountCents,
      );
      await tx
        .update(recurringRules)
        .set({
          nextDueDate: nextOccurrenceAfter(rule, date),
          updatedAt: new Date(),
        })
        .where(eq(recurringRules.id, ruleId));
      return {
        posted: Boolean(created),
        date,
        transactionId: created?.id ?? null,
        goalAllocation: created?.goalAllocation ?? [],
      };
    });
  }

  /** Skips the next occurrence without posting it. */
  async skip(userId: string, ruleId: string) {
    const rule = await this.findOwned(userId, ruleId);
    if (!rule.nextDueDate) throw new BadRequestException('This rule has ended');
    const [updated] = await this.db
      .update(recurringRules)
      .set({
        nextDueDate: nextOccurrenceAfter(rule, rule.nextDueDate),
        updatedAt: new Date(),
      })
      .where(eq(recurringRules.id, ruleId))
      .returning();
    return { skipped: rule.nextDueDate, nextDueDate: updated.nextDueDate };
  }

  /**
   * Inserts one occurrence; returns null if it already exists (posted
   * earlier, or posted and then deleted, which counts as skipped).
   */
  private async postOccurrence(
    tx: DbExecutor,
    rule: RuleRow,
    date: string,
    amountCents: number,
  ) {
    const period = billingPeriod(date, rule.periodOffsetMonths);
    const [created] = await tx
      .insert(transactions)
      .values({
        userId: rule.userId,
        type: rule.type,
        accountId: rule.accountId,
        counterAccountId: rule.counterAccountId,
        categoryId: rule.categoryId,
        amountCents,
        date: new Date(date),
        transactionYear: period.year,
        transactionMonth: period.month,
        note: rule.note ?? rule.name,
        recurringRuleId: rule.id,
        occurrenceDate: date,
      })
      .onConflictDoNothing()
      .returning();
    if (!created) return null;

    const goalAllocation =
      created.type === 'income'
        ? await this.goalsService.allocateIncome(tx, rule.userId, created)
        : [];
    return { id: created.id, goalAllocation };
  }

  private assertScheduleFields(
    type: string,
    isSubscription: boolean | undefined,
    anchorDate: string,
    endDate: string | null | undefined,
  ) {
    if (isSubscription && type !== 'expense') {
      throw new BadRequestException('Only expenses can be subscriptions');
    }
    if (endDate && endDate.slice(0, 10) < anchorDate) {
      throw new BadRequestException(
        'The end date is before the first occurrence',
      );
    }
  }

  private async findLinkableEntry(userId: string, transactionId: string) {
    const [entry] = await this.db
      .select({
        id: transactions.id,
        recurringRuleId: transactions.recurringRuleId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .limit(1);
    if (!entry) throw new NotFoundException('Transaction not found');
    if (entry.recurringRuleId)
      throw new BadRequestException(
        'This entry already belongs to a recurring rule',
      );
    return entry;
  }

  private async findOwned(userId: string, ruleId: string): Promise<RuleRow> {
    const [rule] = await this.db
      .select()
      .from(recurringRules)
      .where(
        and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId)),
      )
      .limit(1);
    if (!rule) throw new NotFoundException('Recurring rule not found');
    return rule;
  }
}
