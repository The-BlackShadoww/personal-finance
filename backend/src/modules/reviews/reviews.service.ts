import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { formatMoney } from '../../common/money/format';
import { currentYearMonth, safeTimezone } from '../../common/time/timezone';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { monthlyReviews } from '../../db/schema';
import { PlanService } from '../budgets/plan.service';
import { CalculationsService } from '../calculations/calculations.service';
import { detectLifestyleCreep } from '../insights/calc/spending-insights';
import { InsightsService } from '../insights/insights.service';
import {
  monthlyEquivalent,
  type Frequency,
} from '../recurring/calc/recurrence';
import {
  buildLeaks,
  buildWins,
  repeatedNo,
  worthItCandidates,
  type ReviewItem,
  type WorthIt,
} from './calc/review';
import { CompleteReviewDto } from './dto/review.dto';

type YearMonth = { year: number; month: number };
type ReviewUser = {
  id: string;
  timezone: string;
  currency: string;
  locale: string;
};

const RATINGS: readonly WorthIt[] = ['yes', 'meh', 'no'];
/** Reviews whose "worth it?" ratings count toward a repeated "no". */
const RATING_HISTORY = 3;

const toIndex = ({ year, month }: YearMonth) => year * 12 + (month - 1);
const fromIndex = (index: number): YearMonth => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});
const monthKey = ({ year, month }: YearMonth) =>
  `${year}-${String(month).padStart(2, '0')}`;

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly planService: PlanService,
    private readonly calculationsService: CalculationsService,
    private readonly insightsService: InsightsService,
  ) {}

  /**
   * Whether last month's review is waiting, plus past reviews. A month with
   * no recorded activity needs no review.
   */
  async getStatus(userId: string, timezone: string) {
    const last = fromIndex(
      toIndex(currentYearMonth(safeTimezone(timezone))) - 1,
    );
    const [history, [activity]] = await Promise.all([
      this.db
        .select({
          year: monthlyReviews.year,
          month: monthlyReviews.month,
          completedAt: monthlyReviews.completedAt,
          action: monthlyReviews.action,
          actionDone: monthlyReviews.actionDone,
          healthScore: monthlyReviews.healthScore,
        })
        .from(monthlyReviews)
        .where(eq(monthlyReviews.userId, userId))
        .orderBy(desc(monthlyReviews.year), desc(monthlyReviews.month))
        .limit(12),
      this.db.execute<{ any: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM transactions
          WHERE user_id = ${userId} AND deleted_at IS NULL
            AND transaction_year = ${last.year} AND transaction_month = ${last.month}
        ) AS any
      `),
    ]);
    const done = history.some(
      (review) => review.year === last.year && review.month === last.month,
    );
    return {
      due: !done && activity?.any ? last : null,
      history,
    };
  }

  /** The review for a closed month: generated content, plus the saved answers if completed. */
  async getReview(user: ReviewUser, year: number, month: number) {
    this.assertClosed(user.timezone, { year, month });
    const period = { year, month };
    const previous = fromIndex(toIndex(period) - 1);

    const [content, saved, previousReview, history, overview] =
      await Promise.all([
        this.buildContent(user, period),
        this.find(user.id, period),
        this.find(user.id, previous),
        this.previousRatings(user.id, period),
        this.insightsService.getOverview(user.id, user.timezone, 2),
      ]);

    const lastScore = await this.lastHealthScore(user.id, period);
    return {
      year,
      month,
      completed: saved
        ? {
            completedAt: saved.completedAt,
            worthIt: saved.worthIt as Record<string, WorthIt>,
            action: saved.action,
            actionDone: saved.actionDone,
          }
        : null,
      numbers: {
        ...content.numbers,
        healthScore: saved?.healthScore ?? overview.health.score,
        previousHealthScore: lastScore,
      },
      // A completed review shows what was shown when it was done.
      wins: saved ? (saved.wins as ReviewItem[]) : content.wins,
      leaks: saved ? (saved.leaks as ReviewItem[]) : content.leaks,
      worthIt: content.worthIt.map((candidate) => ({
        ...candidate,
        previousNo: history.filter(
          (ratings) => ratings[candidate.categoryId] === 'no',
        ).length,
      })),
      suggestedActions: [
        overview.nextAction.key === 'on_track'
          ? null
          : overview.nextAction.title,
        ...content.leaks.map((leak) => leak.title),
      ].filter((text): text is string => Boolean(text)),
      previousAction: previousReview?.action
        ? {
            year: previous.year,
            month: previous.month,
            action: previousReview.action,
            done: previousReview.actionDone,
          }
        : null,
    };
  }

  /** Saves the review (again, if it was already done). */
  async complete(
    user: ReviewUser,
    year: number,
    month: number,
    dto: CompleteReviewDto,
  ) {
    this.assertClosed(user.timezone, { year, month });
    const period = { year, month };
    const worthIt = Object.fromEntries(
      Object.entries(dto.worthIt ?? {}).filter(([, rating]) =>
        RATINGS.includes(rating),
      ),
    ) as Record<string, WorthIt>;

    const [content, overview, history] = await Promise.all([
      this.buildContent(user, period),
      this.insightsService.getOverview(user.id, user.timezone, 2),
      this.previousRatings(user.id, period),
    ]);
    const values = {
      wins: content.wins,
      leaks: content.leaks,
      worthIt,
      action: dto.action?.trim() || null,
      healthScore: overview.health.score,
      completedAt: new Date(),
    };

    await this.db.transaction(async (tx) => {
      await tx
        .insert(monthlyReviews)
        .values({ userId: user.id, year, month, ...values })
        .onConflictDoUpdate({
          target: [
            monthlyReviews.userId,
            monthlyReviews.year,
            monthlyReviews.month,
          ],
          set: values,
        });
      if (dto.previousActionDone !== undefined) {
        const previous = fromIndex(toIndex(period) - 1);
        await tx
          .update(monthlyReviews)
          .set({ actionDone: dto.previousActionDone })
          .where(
            and(
              eq(monthlyReviews.userId, user.id),
              eq(monthlyReviews.year, previous.year),
              eq(monthlyReviews.month, previous.month),
            ),
          );
      }
    });

    // Rated "no" again: suggest spending less there next month.
    const lowerBudgets = repeatedNo(worthIt, history).map((categoryId) => ({
      categoryId,
      name:
        content.worthIt.find((c) => c.categoryId === categoryId)?.name ?? '',
    }));
    return { saved: true, lowerBudgets };
  }

  // ---- content ----

  private async buildContent(user: ReviewUser, period: YearMonth) {
    const money = (cents: number) =>
      formatMoney(cents, { currency: user.currency, locale: user.locale });
    const zone = safeTimezone(user.timezone);
    const sixBack = fromIndex(toIndex(period) - 5);

    const [plan, summary, surplus, months, subscriptions, netWorth] =
      await Promise.all([
        this.planService.getPlan(user.id, period.year, period.month),
        this.calculationsService.getMonthlySummary(
          user.id,
          period.year,
          period.month,
        ),
        this.calculationsService.getSurplusAllocation(
          user.id,
          period.year,
          period.month,
        ),
        this.calculationsService.getMonthlyTotals(user.id, sixBack, period),
        this.db.execute<{
          name: string;
          amount_cents: string;
          frequency: Frequency;
        }>(sql`
          SELECT name, amount_cents, frequency FROM recurring_rules
          WHERE user_id = ${user.id} AND is_subscription
            AND to_char(created_at AT TIME ZONE ${zone}, 'YYYY-MM') = ${monthKey(period)}
        `),
        this.netWorthChange(user, period),
      ]);

    const incomeCents = Math.round(summary.totalIncome * 100);
    const expenseCents = Math.round(summary.totalExpense * 100);
    const categories = [...plan.needs.categories, ...plan.wants.categories].map(
      (category) => ({
        categoryId: category.categoryId,
        name: category.name,
        essential: category.essential,
        availableCents: category.availableCents,
        spentCents: category.spentCents,
        averageCents: category.averageCents,
      }),
    );
    const [creep] = detectLifestyleCreep(
      months.map((m) => m.incomeCents),
      months.map((m) => m.expenseCents),
    );

    const inputs = {
      incomeCents,
      expenseCents,
      netWorthChangeCents: netWorth,
      categories,
      goalContributionCents: plan.payFirst.goals.reduce(
        (sum, goal) => sum + goal.actualCents,
        0,
      ),
      investedCents: Math.round(surplus.invested * 100),
      debtRepaidCents: Math.round(surplus.debtRepaid * 100),
      newSubscriptions: subscriptions.map((rule) => ({
        name: rule.name,
        monthlyCents: monthlyEquivalent(
          Number(rule.amount_cents),
          rule.frequency,
        ),
      })),
      creep: creep
        ? {
            title: creep.title,
            detail: creep.detail,
            amountCents: creep.amountCents,
          }
        : null,
    };

    return {
      numbers: {
        incomeCents,
        expenseCents,
        savingsRate:
          incomeCents > 0
            ? Math.round(((incomeCents - expenseCents) / incomeCents) * 1000) /
              10
            : null,
        savingsTarget: 20,
        netWorthChangeCents: netWorth,
      },
      wins: buildWins(inputs, money),
      leaks: buildLeaks(inputs, money),
      worthIt: worthItCandidates(categories),
    };
  }

  /** Net worth at the end of the month minus at the end of the month before. */
  private async netWorthChange(user: ReviewUser, period: YearMonth) {
    const current = currentYearMonth(safeTimezone(user.timezone));
    const monthsBack = toIndex(current) - toIndex(period) + 2;
    const series = await this.insightsService.getNetWorthSeries(
      user.id,
      user.timezone,
      Math.max(2, monthsBack),
    );
    const at = (p: YearMonth) =>
      series.find((point) => point.month === monthKey(p))?.netWorthCents;
    const end = at(period);
    const start = at(fromIndex(toIndex(period) - 1));
    return end === undefined || start === undefined ? null : end - start;
  }

  private async find(userId: string, period: YearMonth) {
    const [review] = await this.db
      .select()
      .from(monthlyReviews)
      .where(
        and(
          eq(monthlyReviews.userId, userId),
          eq(monthlyReviews.year, period.year),
          eq(monthlyReviews.month, period.month),
        ),
      )
      .limit(1);
    return review ?? null;
  }

  /** "Worth it?" ratings from the reviews before this one, newest first. */
  private async previousRatings(userId: string, period: YearMonth) {
    const rows = await this.db
      .select({ worthIt: monthlyReviews.worthIt })
      .from(monthlyReviews)
      .where(
        and(
          eq(monthlyReviews.userId, userId),
          sql`(${monthlyReviews.year}, ${monthlyReviews.month}) < (${period.year}, ${period.month})`,
        ),
      )
      .orderBy(desc(monthlyReviews.year), desc(monthlyReviews.month))
      .limit(RATING_HISTORY);
    return rows.map((row) => row.worthIt as Record<string, WorthIt>);
  }

  /** The health score saved with the latest review before this one. */
  private async lastHealthScore(userId: string, period: YearMonth) {
    const [row] = await this.db
      .select({ healthScore: monthlyReviews.healthScore })
      .from(monthlyReviews)
      .where(
        and(
          eq(monthlyReviews.userId, userId),
          sql`(${monthlyReviews.year}, ${monthlyReviews.month}) < (${period.year}, ${period.month})`,
        ),
      )
      .orderBy(desc(monthlyReviews.year), desc(monthlyReviews.month))
      .limit(1);
    return row?.healthScore ?? null;
  }

  private assertClosed(timezone: string, period: YearMonth) {
    if (period.month < 1 || period.month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
    const current = currentYearMonth(safeTimezone(timezone));
    if (toIndex(period) >= toIndex(current)) {
      throw new BadRequestException(
        'A month can be reviewed once it has ended',
      );
    }
  }
}
