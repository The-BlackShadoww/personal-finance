import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/relations';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
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

export const accountConfig = pgTable('account_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  initialBalanceCents: bigint('initial_balance_cents', { mode: 'number' }).notNull().default(0),
  lowBalanceThresholdCents: bigint('low_balance_threshold_cents', { mode: 'number' }).notNull().default(500000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const savingsSectors = pgTable(
  'savings_sectors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    percentage: integer('percentage').notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#6b7280'),
    icon: varchar('icon', { length: 50 }).notNull().default('piggy-bank'),
    targetAmountCents: bigint('target_amount_cents', { mode: 'number' }),
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('savings_sectors_user_id_idx').on(table.userId),
    uniqueIndex('savings_sectors_user_name_idx').on(table.userId, table.name),
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
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
}));

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
