import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/relations';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// A transfer moves money between two of the user's accounts. It is neither
// income nor spending, so it never changes the savings rate.
export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
  'transfer',
]);

export const accountKindEnum = pgEnum('account_kind', [
  'cash',
  'bank',
  'mobile_wallet',
  'savings',
  'investment',
  'retirement',
  'property',
  'credit_card',
  'loan',
  'other',
]);

export const accountNatureEnum = pgEnum('account_nature', [
  'asset',
  'liability',
]);

export const assetClassEnum = pgEnum('asset_class', [
  'equity',
  'bond',
  'cash',
  'real_estate',
  'gold',
  'mixed',
  'other',
]);

export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);

// Marks categories that feed specific ratios (housing cost, debt service, …).
export const categoryTagEnum = pgEnum('category_tag', [
  'housing',
  'debt_interest',
  'insurance',
  'education',
  'health',
]);

export const incomeKindEnum = pgEnum('income_kind', [
  'active',
  'passive',
  'portfolio',
]);

export const incomeStabilityEnum = pgEnum('income_stability', [
  'stable',
  'variable',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    googleId: varchar('google_id', { length: 255 }),
    twoFactorSecret: text('two_factor_secret'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
    // ISO 4217 code and BCP 47 locale used to display money.
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    locale: varchar('locale', { length: 35 }).notNull().default('en-US'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    index('users_google_id_idx').on(table.googleId),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: categoryTypeEnum('type').notNull(),
    color: varchar('color', { length: 7 }),
    icon: varchar('icon', { length: 50 }),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    // A need rather than a want: drives 50/30/20, emergency-fund targets and runway.
    essential: boolean('essential').notNull().default(false),
    // Roughly the same amount every month: drives the fixed-cost ratio and forecasts.
    fixed: boolean('fixed').notNull().default(false),
    tag: categoryTagEnum('tag'),
    // Income categories only.
    incomeKind: incomeKindEnum('income_kind'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('categories_user_id_idx').on(table.userId),
    uniqueIndex('categories_user_id_name_type_idx').on(
      table.userId,
      table.name,
      table.type,
    ),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Income/expense: the account money arrived in or left from.
    // Transfer: the source account.
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    // Transfers only: the destination account.
    counterAccountId: uuid('counter_account_id').references(() => accounts.id),
    // Income and expense only; transfers have no category.
    categoryId: uuid('category_id').references(() => categories.id),
    type: transactionTypeEnum('type').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    transactionMonth: integer('transaction_month').notNull().default(0),
    transactionYear: integer('transaction_year').notNull().default(0),
    note: text('note'),
    // Set when a recurring rule posted this entry. Deleting the entry keeps
    // the slot taken, so the occurrence counts as skipped, not re-posted.
    recurringRuleId: uuid('recurring_rule_id').references(
      () => recurringRules.id,
      { onDelete: 'set null' },
    ),
    occurrenceDate: date('occurrence_date', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('transactions_recurring_occurrence_idx')
      .on(table.recurringRuleId, table.occurrenceDate)
      .where(sql`${table.recurringRuleId} IS NOT NULL`),
    index('transactions_user_id_idx').on(table.userId),
    index('transactions_user_id_date_idx').on(table.userId, table.date),
    index('transactions_period_idx').on(
      table.transactionMonth,
      table.transactionYear,
    ),
    index('transactions_user_period_idx').on(
      table.userId,
      table.transactionYear,
      table.transactionMonth,
    ),
    index('transactions_category_id_idx').on(table.categoryId),
    index('transactions_type_idx').on(table.type),
    index('transactions_user_account_date_idx').on(
      table.userId,
      table.accountId,
      table.date,
    ),
    index('transactions_counter_account_idx').on(table.counterAccountId),
    // Compared as text: a check may not use an enum value added in the
    // same migration transaction.
    check(
      'transactions_transfer_shape_check',
      sql`CASE WHEN ${table.type}::text = 'transfer'
        THEN ${table.counterAccountId} IS NOT NULL AND ${table.categoryId} IS NULL
        ELSE ${table.counterAccountId} IS NULL AND ${table.categoryId} IS NOT NULL END`,
    ),
    check(
      'transactions_distinct_accounts_check',
      sql`${table.counterAccountId} IS DISTINCT FROM ${table.accountId}`,
    ),
    check('transactions_amount_positive_check', sql`${table.amountCents} > 0`),
  ],
);

export const recurringFrequencyEnum = pgEnum('recurring_frequency', [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
]);

/**
 * A template that posts an entry on a schedule: salary, rent, a
 * subscription, "invest every payday". Occurrences fall on the anchor date's
 * weekday (weekly/biweekly) or day of month, clamped to shorter months.
 */
export const recurringRules = pgTable(
  'recurring_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: transactionTypeEnum('type').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    counterAccountId: uuid('counter_account_id').references(() => accounts.id),
    categoryId: uuid('category_id').references(() => categories.id),
    note: text('note'),
    frequency: recurringFrequencyEnum('frequency').notNull(),
    // The first occurrence; later ones follow from it.
    anchorDate: date('anchor_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    // The next occurrence not yet posted or skipped.
    nextDueDate: date('next_due_date', { mode: 'string' }),
    // Which billing month an occurrence counts toward, relative to its
    // date: -1 (rent paid on the 1st for last month) to +1.
    periodOffsetMonths: integer('period_offset_months').notNull().default(0),
    // Post automatically when due; otherwise wait for confirmation.
    autoPost: boolean('auto_post').notNull().default(false),
    isSubscription: boolean('is_subscription').notNull().default(false),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('recurring_rules_user_due_idx').on(table.userId, table.nextDueDate),
    check(
      'recurring_rules_transfer_shape_check',
      sql`CASE WHEN ${table.type}::text = 'transfer'
        THEN ${table.counterAccountId} IS NOT NULL AND ${table.categoryId} IS NULL
        ELSE ${table.counterAccountId} IS NULL AND ${table.categoryId} IS NOT NULL END`,
    ),
    check(
      'recurring_rules_amount_positive_check',
      sql`${table.amountCents} > 0`,
    ),
    check(
      'recurring_rules_period_offset_check',
      sql`${table.periodOffsetMonths} BETWEEN -1 AND 1`,
    ),
  ],
);

/**
 * Where money lives (bank, cash, mobile wallet, savings, investments) or is
 * owed (credit card, loan). Balances are derived from the opening balance and
 * the ledger; for liabilities the balance is the amount owed.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    kind: accountKindEnum('kind').notNull(),
    // Derived from kind; stored so SQL can sign balances without a lookup.
    nature: accountNatureEnum('nature').notNull(),
    // Can be spent within days without penalty: counts toward runway and
    // the emergency fund.
    isLiquid: boolean('is_liquid').notNull(),
    // The account new transactions default to; one per user.
    isDefault: boolean('is_default').notNull().default(false),
    // Owned (assets) or owed (liabilities) before the first recorded transaction.
    openingBalanceCents: bigint('opening_balance_cents', { mode: 'number' })
      .notNull()
      .default(0),
    // APR for debts, yield for savings, in basis points.
    interestRateBps: integer('interest_rate_bps'),
    minimumPaymentCents: bigint('minimum_payment_cents', { mode: 'number' }),
    creditLimitCents: bigint('credit_limit_cents', { mode: 'number' }),
    assetClass: assetClassEnum('asset_class'),
    // Annual fund fee in basis points.
    expenseRatioBps: integer('expense_ratio_bps'),
    color: varchar('color', { length: 7 }).notNull().default('#6b7280'),
    icon: varchar('icon', { length: 50 }).notNull().default('wallet'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('accounts_user_id_idx').on(table.userId),
    uniqueIndex('accounts_user_name_idx').on(table.userId, table.name),
    uniqueIndex('accounts_user_default_idx')
      .on(table.userId)
      .where(sql`${table.isDefault}`),
  ],
);

/**
 * What an investment, retirement or property account was worth on a date.
 * Its value later is the latest valuation plus money moved in or out since,
 * so contributions count before the next valuation is entered.
 */
export const accountValuations = pgTable(
  'account_valuations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    valueCents: bigint('value_cents', { mode: 'number' }).notNull(),
    note: varchar('note', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('account_valuations_account_date_idx').on(
      table.accountId,
      table.date,
    ),
    index('account_valuations_user_id_idx').on(table.userId),
    check('account_valuations_value_check', sql`${table.valueCents} >= 0`),
  ],
);

/** The mix of asset classes the user aims to hold across investments. */
export const targetAllocations = pgTable(
  'target_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetClass: assetClassEnum('asset_class').notNull(),
    // Share of invested money, in basis points (6000 = 60%).
    percentBps: integer('percent_bps').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('target_allocations_user_class_idx').on(
      table.userId,
      table.assetClass,
    ),
    check(
      'target_allocations_percent_check',
      sql`${table.percentBps} BETWEEN 1 AND 10000`,
    ),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    // Unspent money (or overspending) carries into the next month.
    rollover: boolean('rollover').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('budgets_user_id_idx').on(table.userId),
    unique('budgets_user_year_month_category_idx')
      .on(table.userId, table.year, table.month, table.categoryId)
      .nullsNotDistinct(),
  ],
);

export const budgetMethodEnum = pgEnum('budget_method', [
  // Every unit of expected income gets a job; "left to assign" reaches 0.
  'zero_based',
  // Needs ≤ 50%, wants ≤ 30%, saving and extra debt ≥ 20%.
  'fifty_thirty_twenty',
  // Living ≤ 70%, saving ≥ 20%, debt and giving 10%.
  'seventy_twenty_ten',
  // Caps per category, no income targets.
  'category_caps',
]);

/** A month's spending plan: expected income and the budgeting method. */
export const monthlyPlans = pgTable(
  'monthly_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    // Null means "suggest from recent income".
    expectedIncomeCents: bigint('expected_income_cents', { mode: 'number' }),
    method: budgetMethodEnum('method').notNull().default('fifty_thirty_twenty'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('monthly_plans_user_period_idx').on(
      table.userId,
      table.year,
      table.month,
    ),
  ],
);

export const accountConfig = pgTable('account_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  initialBalanceCents: bigint('initial_balance_cents', { mode: 'number' })
    .notNull()
    .default(0),
  lowBalanceThresholdCents: bigint('low_balance_threshold_cents', {
    mode: 'number',
  })
    .notNull()
    .default(500000),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const savingsSectors = pgTable(
  'savings_sectors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    percentage: integer('percentage').notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#6b7280'),
    icon: varchar('icon', { length: 50 }).notNull().default('piggy-bank'),
    targetAmountCents: bigint('target_amount_cents', { mode: 'number' }),
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('savings_sectors_user_id_idx').on(table.userId),
    uniqueIndex('savings_sectors_user_name_idx').on(table.userId, table.name),
  ],
);

export const goalKindEnum = pgEnum('goal_kind', [
  // One per user; its target is sized from essential spending.
  'emergency',
  // A known future cost with a date (insurance, festival, laptop).
  'sinking',
  'long_term',
  'custom',
]);

export const goalFundingRuleEnum = pgEnum('goal_funding_rule', [
  // A share of every income, set aside when the income is recorded.
  'percent_of_income',
  // A fixed amount per billing month, taken from that month's income.
  'fixed_monthly',
  'manual',
]);

export const goalContributionKindEnum = pgEnum('goal_contribution_kind', [
  'contribution',
  'withdrawal',
  // Set aside automatically from an income.
  'auto',
  // Carried over when savings sectors became goals.
  'opening',
]);

export const goalWithdrawalReasonEnum = pgEnum('goal_withdrawal_reason', [
  'emergency',
  'planned_purchase',
  'rebalancing',
  'other',
]);

/**
 * Money earmarked inside an account for a purpose. A goal's balance is the
 * sum of its contributions; the money itself stays in `accountId`.
 */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    kind: goalKindEnum('kind').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    // Not used for the emergency goal, whose target is computed.
    targetAmountCents: bigint('target_amount_cents', { mode: 'number' }),
    targetDate: date('target_date', { mode: 'string' }),
    // Emergency goal only; null follows the financial profile (3 or 6).
    targetMonths: integer('target_months'),
    // Sinking funds: the target date moves on a year once it passes.
    repeatsYearly: boolean('repeats_yearly').notNull().default(false),
    // Sinking funds: expenses in this category can be paid from the goal.
    categoryId: uuid('category_id').references(() => categories.id),
    // Order in which income is shared out; lower first.
    priority: integer('priority').notNull().default(0),
    fundingRule: goalFundingRuleEnum('funding_rule')
      .notNull()
      .default('manual'),
    fundingPercentBps: integer('funding_percent_bps'),
    fundingAmountCents: bigint('funding_amount_cents', { mode: 'number' }),
    color: varchar('color', { length: 7 }).notNull().default('#16a34a'),
    icon: varchar('icon', { length: 50 }).notNull().default('piggy-bank'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('goals_user_id_idx').on(table.userId),
    uniqueIndex('goals_user_name_idx').on(table.userId, table.name),
    uniqueIndex('goals_user_emergency_idx')
      .on(table.userId)
      .where(sql`${table.kind} = 'emergency'`),
    check(
      'goals_funding_shape_check',
      sql`CASE ${table.fundingRule}
        WHEN 'percent_of_income' THEN ${table.fundingPercentBps} BETWEEN 1 AND 10000
        WHEN 'fixed_monthly' THEN ${table.fundingAmountCents} > 0
        ELSE true END`,
    ),
  ],
);

export const goalContributions = pgTable(
  'goal_contributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Positive adds to the goal, negative takes from it.
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    kind: goalContributionKindEnum('kind').notNull(),
    // The income that funded an auto contribution, or the expense a
    // withdrawal paid for. Removing that entry removes this row.
    sourceTransactionId: uuid('source_transaction_id').references(
      () => transactions.id,
    ),
    // The transfer that moved the money into the goal's account, if any.
    transferTransactionId: uuid('transfer_transaction_id').references(
      () => transactions.id,
    ),
    reason: goalWithdrawalReasonEnum('reason'),
    note: varchar('note', { length: 200 }),
    date: date('date', { mode: 'string' }).notNull(),
    // Billing period the money came from, for fixed-monthly funding.
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('goal_contributions_goal_id_idx').on(table.goalId),
    index('goal_contributions_user_id_idx').on(table.userId),
    index('goal_contributions_source_idx').on(table.sourceTransactionId),
    check(
      'goal_contributions_sign_check',
      sql`CASE WHEN ${table.kind}::text = 'withdrawal'
        THEN ${table.amountCents} < 0 AND ${table.reason} IS NOT NULL
        ELSE ${table.amountCents} > 0 END`,
    ),
  ],
);

// Answers that tune thresholds and advice (emergency-fund size, insurance
// checks, employer match, FI assumptions). A null answer means "not answered".
export const financialProfiles = pgTable('financial_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  incomeStability: incomeStabilityEnum('income_stability'),
  dependents: integer('dependents'),
  hasHealthInsurance: boolean('has_health_insurance'),
  hasLifeInsurance: boolean('has_life_insurance'),
  employerMatchPercent: integer('employer_match_percent'),
  retirementAgeTarget: integer('retirement_age_target'),
  safeWithdrawalBps: integer('safe_withdrawal_bps').notNull().default(400),
  expectedRealReturnBps: integer('expected_real_return_bps')
    .notNull()
    .default(500),
  // Non-essential purchases at or above this are offered the cooling-off
  // list; null turns the rule off.
  coolingOffThresholdCents: bigint('cooling_off_threshold_cents', {
    mode: 'number',
  }),
  coolingOffHours: integer('cooling_off_hours').notNull().default(48),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A completed monthly review: what went well, what leaked, which spending
 * was worth it, and the one thing to do next month.
 */
export const monthlyReviews = pgTable(
  'monthly_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    // Generated when the review is completed; kept as they were shown.
    wins: jsonb('wins').notNull().default([]),
    leaks: jsonb('leaks').notNull().default([]),
    // { [categoryId]: 'yes' | 'meh' | 'no' }
    worthIt: jsonb('worth_it').notNull().default({}),
    action: text('action'),
    // Asked at the next review; null until answered.
    actionDone: boolean('action_done'),
    // The health score when the review was completed, to show change.
    healthScore: integer('health_score'),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('monthly_reviews_user_period_idx').on(
      table.userId,
      table.year,
      table.month,
    ),
  ],
);

export const wishlistDecisionEnum = pgEnum('wishlist_decision', [
  'pending',
  'bought',
  'skipped',
]);

/** The cooling-off list: wants that wait before they are bought. */
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    url: text('url'),
    categoryId: uuid('category_id').references(() => categories.id),
    // The decision is asked for once this passes.
    coolUntil: timestamp('cool_until', { withTimezone: true }).notNull(),
    decision: wishlistDecisionEnum('decision').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    // The expense recorded when it was bought.
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('wishlist_items_user_idx').on(table.userId, table.decision),
    check('wishlist_items_amount_check', sql`${table.amountCents} > 0`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenFamily: uuid('token_family').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_token_family_idx').on(table.tokenFamily),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  refreshTokens: many(refreshTokens),
  accountConfig: one(accountConfig),
  savingsSectors: many(savingsSectors),
  financialProfile: one(financialProfiles),
  accounts: many(accounts),
  goals: many(goals),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
    relationName: 'transaction_account',
  }),
  counterAccount: one(accounts, {
    fields: [transactions.counterAccountId],
    references: [accounts.id],
    relationName: 'transaction_counter_account',
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions, { relationName: 'transaction_account' }),
  incomingTransfers: many(transactions, {
    relationName: 'transaction_counter_account',
  }),
  valuations: many(accountValuations),
}));

export const accountValuationsRelations = relations(
  accountValuations,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountValuations.accountId],
      references: [accounts.id],
    }),
  }),
);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const accountConfigRelations = relations(accountConfig, ({ one }) => ({
  user: one(users, { fields: [accountConfig.userId], references: [users.id] }),
}));

export const savingsSectorsRelations = relations(savingsSectors, ({ one }) => ({
  user: one(users, { fields: [savingsSectors.userId], references: [users.id] }),
}));

export const financialProfilesRelations = relations(
  financialProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [financialProfiles.userId],
      references: [users.id],
    }),
  }),
);

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  account: one(accounts, {
    fields: [goals.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [goals.categoryId],
    references: [categories.id],
  }),
  contributions: many(goalContributions),
}));

export const goalContributionsRelations = relations(
  goalContributions,
  ({ one }) => ({
    goal: one(goals, {
      fields: [goalContributions.goalId],
      references: [goals.id],
    }),
  }),
);
