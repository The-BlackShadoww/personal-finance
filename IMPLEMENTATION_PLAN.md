# Implementation Plan — From Expense Tracker to Financial Coach

This plan covers every feature proposed in the product review (Tiers 1–3) and
builds them so the app actively guides users through the evidence-based order of
financial operations and the behavioural rules that make them stick.

> **Status:** Phases 0–4 implemented; Phases 5–7 proposed · **Scope:** backend (NestJS + Drizzle) and frontend (Next.js)
> · **Out of scope:** bank-feed integrations, multi-currency within one user,
> ticker-level market prices.

---

## Contents

1. [Guiding principles](#1-guiding-principles)
2. [Target domain model](#2-target-domain-model)
3. [Phase 0 — Foundations](#phase-0--foundations)
4. [Phase 1 — Accounts & transfers](#phase-1--accounts--transfers)
5. [Phase 2 — Funded goals & sinking funds](#phase-2--funded-goals--sinking-funds)
6. [Phase 3 — Spending plan: budgets & rule templates](#phase-3--spending-plan-budgets--rule-templates)
7. [Phase 4 — Recurring transactions & automation](#phase-4--recurring-transactions--automation)
8. [Phase 5 — Insights: health score, runway, net worth, spending insights](#phase-5--insights)
9. [Phase 6 — Wealth building: debt, FI, investments, income](#phase-6--wealth-building)
10. [Phase 7 — Habits: monthly review & cooling-off list](#phase-7--habits)
11. [Cross-cutting concerns](#cross-cutting-concerns)
12. [Sequencing & sizing](#sequencing--sizing)
13. [Appendix — formulas & thresholds](#appendix--formulas--thresholds)

---

## 1. Guiding principles

Every feature below must support one or both of these lists. The traceability
matrix at the end of each phase shows which principle a feature serves.

### A. Order of operations (the "money waterfall")

| # | Step | How the app enforces it |
|---|---|---|
| W1 | Starter buffer: 1 month of expenses | Emergency goal starts with a 1-month milestone; Next Best Action (NBA) #1 |
| W2 | Capture employer match | Financial profile flag → NBA #2 |
| W3 | Kill high-interest debt (APR ≥ 8%) with avalanche | Debt planner defaults to avalanche; NBA #3 |
| W4 | Full emergency fund: 3–6 months essentials (6–12 if income is variable) | Emergency target auto-computed from essential spending |
| W5 | Invest ≥ 15–20% of income, consistently | Investment-rate metric; recurring transfer to investment account |
| W6 | Sinking funds for known future costs | Goal kind `sinking` with target date and auto monthly amount |
| W7 | Insure catastrophes | Financial-profile checklist in the health score |
| W8 | Grow income | Income-source tracking, active vs passive |
| W9 | Guard against lifestyle creep (save ≥ 50% of raises) | Creep detector in monthly review |
| W10 | Review monthly, rebalance yearly, keep fees low | Monthly review ritual; allocation drift and fee-drag in investments |

### B. Behavioural rules

| # | Rule | How the app enforces it |
|---|---|---|
| B1 | Automate saving on payday | Income triggers goal contributions automatically (pay yourself first) |
| B2 | 48-hour rule for non-essential purchases | Cooling-off list |
| B3 | Spend on what you value | "Worth it?" rating in monthly review |
| B4 | Track net worth, not just spending | Net worth becomes a primary dashboard metric |
| B5 | Friction for bad behaviour, ease for good | Withdrawing from goals needs a reason; contributing is one tap |
| B6 | One clear next step, not ten | A single Next Best Action card, ordered by the waterfall |
| B7 | No shame | Neutral copy; overspending shows as "rebalance", not red failure |

### C. Engineering principles (inherited from the codebase)

- Money is integer minor units (cents/poisha). **Never** floats in storage or maths.
- One round trip per screen (follow `getDashboardOverview`); grouped SQL, no N+1.
- All maths that decides advice lives in **pure, unit-tested functions**.
- Every advisory output shows its inputs and assumptions — explainable, not magic.
- Educational framing only: no product or security recommendations.

---

## 2. Target domain model

```text
users ──┬── financial_profile (1:1)            # dependents, income stability, match, insurance
        ├── accounts (1:n) ──── account_valuations (1:n)   # market value for investment accounts
        ├── categories (1:n)                    # + essential, fixed, tag, income_kind
        ├── transactions (1:n)                  # + account_id, counter_account_id, type 'transfer'
        ├── goals (1:n) ──── goal_contributions (1:n)
        ├── budgets (1:n)                       # + rollover
        ├── monthly_plans (1:n)                 # expected income, method (zero-based etc.)
        ├── recurring_rules (1:n)
        ├── monthly_reviews (1:n)
        └── wishlist_items (1:n)                # cooling-off list
```

Replaced/retired: `savings_sectors` → `goals`; `account_config.initial_balance_cents`
→ `accounts.opening_balance_cents` (threshold stays in `account_config` until Phase 5,
then moves to per-account `low_balance_threshold_cents`).

### Core identities (must hold after every phase)

```text
account balance      = opening + Σ income(acct) − Σ expense(acct)
                       − Σ transfers out(acct) + Σ transfers in(acct)
net worth            = Σ asset account balances (or latest valuation)
                       − Σ liability account balances
savings rate         = (income − expense) / income           # transfers never count
goal balance         = Σ goal_contributions(goal)
available to spend   = Σ liquid asset balances − Σ goal balances held in liquid accounts
```

---

## Phase 0 — Foundations

> **Done.** Migration `0005_phase0_foundations`. Existing users received the five new
> expense categories as ordinary (deletable) categories; new users get them as defaults.

Small, low-risk changes every later phase depends on.

### 0.1 Widen money columns to `bigint`

`integer` cents cap at 21,474,836.47 — too small for net worth, property, loans,
or currencies such as BDT/INR/JPY.

- Migrate every `*_cents` column to `bigint('…', { mode: 'number' })` (safe to 2^53).
- Files: `backend/src/db/schema/index.ts`, all services that `Number()` SQL sums (already
  tolerant of string results).
- DTO max: raise `amount` `@Max` to 1e12 to reject nonsense while allowing large values.

### 0.2 User currency and locale

- `users.currency varchar(3) default 'USD'`, `users.locale varchar(20) default 'en-US'`.
- `frontend/src/lib/utils/currency.ts` and `format.ts`: `formatMoney(cents, currency, locale)`
  via `Intl.NumberFormat`; remove the hard-coded `USD` and rename `formatDollar` usages.
- Preferences tab: currency + locale selectors next to timezone.
- PDF/CSV reports read the user's currency.

### 0.3 Category metadata

Needed for 50/30/20, essential-expense emergency targets, housing and fixed-cost ratios.

| Column | Type | Purpose |
|---|---|---|
| `essential` | boolean, default false | Need vs want (50/30/20, emergency target, runway) |
| `fixed` | boolean, default false | Fixed-cost ratio, forecast |
| `tag` | enum nullable: `housing`, `debt_interest`, `insurance`, `education`, `health` | Ratio metrics |
| `income_kind` | enum nullable: `active`, `passive`, `portfolio` | Income tracking (W8) |

- Update seed in `auth.service.ts#seedDefaultCategories`:
  - Rename income `Investment` → `Investment returns` (`income_kind: portfolio`) and add
    helper text: *"Dividends and interest. Money you move into investments is a transfer."*
  - Add expense defaults: `Insurance` (essential, fixed, tag insurance), `Debt interest & fees`
    (essential, tag debt_interest), `Dining out`, `Subscriptions` (fixed), `Education`.
  - Mark `Rent` (essential, fixed, tag housing), `Groceries`, `Utilities`, `Transport`,
    `Health` as essential.
- Backfill migration: apply the same flags to existing default categories by name.
- Category form: two toggles ("Essential", "Fixed each month") and a tag select.

### 0.4 Financial profile

A short onboarding questionnaire whose answers tune thresholds (W2, W4, W7).

```text
financial_profile
  user_id                 uuid pk → users
  income_stability        enum('stable','variable')       # drives 3–6 vs 6–12 months
  dependents              int default 0                   # drives life-insurance check
  has_health_insurance    boolean null
  has_life_insurance      boolean null
  employer_match_percent  int null                        # 0/null = none
  retirement_age_target   int null
  safe_withdrawal_bps     int default 400                 # 4.00%
  expected_real_return_bps int default 500                # 5.00% after inflation
  updated_at
```

- `GET/PUT /profile/financial`; a 5-question onboarding step after the account setup.
- If `income_stability` is unset, infer "variable" when the coefficient of variation
  of the last 6 months' income > 0.25 and show *"Looks irregular — use 6–12 months?"*

**Principles served:** W2, W4, W7, B6 (tailored advice), C.

---

## Phase 1 — Accounts & transfers

> **Done.** Migration `0006_phase1_accounts_transfers`. Every user received a default
> "Main account" holding their previous single balance (verified unchanged for all users).
> Differences from the sketch below: `opening_date` was dropped (the opening balance is
> simply the balance before the first recorded entry); `recurring_rule_id` /
> `occurrence_date` are deferred to Phase 4; the old `/account` page redirects to
> `/accounts`; archiving requires a zero balance so net worth never silently changes.

*Review item #1 (multiple accounts) and the transfer type.* Everything after depends on it.

### 1.1 Schema

```text
accounts
  id, user_id
  name                 varchar(100)
  kind                 enum('cash','bank','mobile_wallet','savings','credit_card',
                            'loan','investment','retirement','property','other')
  nature               enum('asset','liability')      # derived from kind, stored for SQL
  is_liquid            boolean                        # counts toward runway / emergency
  opening_balance_cents bigint default 0              # positive = owned (asset) or owed (liability)
  opening_date         date
  interest_rate_bps    int null                       # APR for debts, yield for savings
  minimum_payment_cents bigint null                   # debts
  credit_limit_cents   bigint null                    # credit cards
  asset_class          enum null ('equity','bond','cash','real_estate','gold','mixed','other')
  expense_ratio_bps    int null                       # fund fees (W10)
  color, icon, sort_order
  archived_at          timestamptz null
  created_at, updated_at
  unique (user_id, name)

transactions  (changes)
  + account_id          uuid not null → accounts
  + counter_account_id  uuid null → accounts          # destination for transfers
  ~ category_id         nullable                      # transfers have no category
  ~ type                enum adds 'transfer'
  + recurring_rule_id   uuid null                      # Phase 4
  + occurrence_date     date null                      # Phase 4 idempotency
  CHECK (type = 'transfer') = (counter_account_id IS NOT NULL AND category_id IS NULL)
  CHECK counter_account_id IS DISTINCT FROM account_id
  index (user_id, account_id, date)
```

A transfer is one row with a source (`account_id`) and a destination
(`counter_account_id`). Semantics by destination kind:

| From → To | Meaning |
|---|---|
| bank → savings / investment / retirement | **Saving / investing** (W5) |
| bank → credit_card / loan | **Debt repayment** (principal; interest goes to the `Debt interest & fees` expense category) |
| loan → bank | Borrowing (liability grows) |
| bank → cash / mobile wallet | Neutral move |

Expense recorded on a `credit_card` account increases that liability.

### 1.2 Migration (three steps, zero downtime)

1. Create `accounts`; add nullable `transactions.account_id`, `counter_account_id`; add
   enum value `transfer`; relax `category_id` nullability.
2. Custom SQL (`drizzle-kit generate --custom`): for each user create *"Main account"*
   (`kind bank`, `is_liquid true`, `opening_balance_cents = account_config.initial_balance_cents`),
   then `UPDATE transactions SET account_id = <main>`.
3. Set `account_id NOT NULL`, add CHECK constraints and indexes.

Keep `account_config.initial_balance_cents` readable for one release, then drop.

### 1.3 Backend

- New `AccountsModule` (`backend/src/modules/accounts/`): CRUD, archive (only if
  balance is zero or the user confirms), `GET /accounts/balances` returning every account's
  balance in **one grouped query**:

  ```sql
  SELECT a.id,
         a.opening_balance_cents
         + COALESCE(SUM(CASE WHEN t.type='income'   AND t.account_id=a.id THEN t.amount_cents END),0)
         - COALESCE(SUM(CASE WHEN t.type='expense'  AND t.account_id=a.id THEN t.amount_cents END),0)
         - COALESCE(SUM(CASE WHEN t.type='transfer' AND t.account_id=a.id THEN t.amount_cents END),0)
         + COALESCE(SUM(CASE WHEN t.type='transfer' AND t.counter_account_id=a.id THEN t.amount_cents END),0)
         AS balance_cents
  FROM accounts a
  LEFT JOIN transactions t
    ON (t.account_id = a.id OR t.counter_account_id = a.id) AND t.deleted_at IS NULL
  WHERE a.user_id = $1 AND a.archived_at IS NULL
  GROUP BY a.id;
  ```

  For liabilities the sign flips (an expense *increases* what's owed) — handle in the
  service by `nature`, covered by unit tests.
- `TransactionsService`: validate that both accounts belong to the user; for transfers
  reject `categoryId`; `getProjectedBalance` becomes per-account.
- `CalculationsService` / `ReportsService`: already filter by `income`/`expense`, so
  transfers are excluded from income, expense and savings rate. Add explicit
  `type <> 'transfer'` guards anywhere `CASE` is not type-specific, and a test that a
  transfer never moves savings rate.
- New summary field `surplusAllocation`: for the period, how much went to savings,
  investments and debt principal (transfers grouped by destination kind). This answers
  *"Where did my surplus go?"*
- Reports: a separate "Transfers" section in PDF/CSV.

### 1.4 Frontend

- Rename nav **Account → Accounts**. Page lists accounts grouped Assets / Liabilities with
  balances, sparkline, and a total (the seed of net worth).
- `TransactionForm`: segmented control gains **Transfer**; account selector (default =
  last used, stored per viewer); transfer mode shows From → To instead of category.
- Transactions list: account filter; transfer rows render as "Bank → Savings" with neutral colour.
- Update `invalidateFinancialData` to include account queries; add `/accounts` to
  `prefetchRoute`.

**Principles served:** W3, W5 (saving no longer looks like spending), B4, C.

---

## Phase 2 — Funded goals & sinking funds

> **Done.** Migration `0007_phase2_goals` converted every savings sector into a goal with an
> opening contribution equal to what the sector showed. Decisions made while building:
> - Goals must live in an asset account. Adding money from another account, or income
>   arriving in another account, creates a real transfer, so every earmark is backed by money.
> - `fixed_monthly` goals are topped up from income in the same billing month (no scheduler yet;
>   Phase 4 recurring rules will feed them on payday).
> - Expenses can be paid from a goal atomically (`payFromGoalId`); editing or deleting the
>   income/expense redoes or removes its goal effects. Goal-made transfers cannot be edited.
> - `debt_payoff` goals are left to Phase 6. Sector endpoints are deprecated and stay one release.

*Review items #2 and #13.* Replaces "% of balance" sectors with real, funded envelopes.

### 2.1 Schema

```text
goals
  id, user_id
  name
  kind                 enum('emergency','sinking','debt_payoff','long_term','custom')
  account_id           uuid null → accounts        # where the money physically sits
  target_amount_cents  bigint null
  target_date          date null
  target_months        numeric(4,1) null           # emergency only: months of essentials
  priority             int                          # waterfall order, lower first
  funding_rule         enum('percent_of_income','fixed_monthly','manual')
  funding_value        int                          # percent (basis points) or cents
  repeats_yearly       boolean default false        # sinking funds that reset
  color, icon, sort_order
  archived_at, created_at, updated_at

goal_contributions
  id, goal_id, user_id
  amount_cents         bigint                       # + contribution, − withdrawal
  kind                 enum('contribution','withdrawal','opening','auto')
  source_transaction_id uuid null → transactions    # the income that triggered 'auto'
  reason               varchar(200) null            # required for withdrawals (B5)
  date
  created_at
```

**Goals are earmarks inside accounts**, not accounts themselves. Invariant enforced in
the service: Σ goal balances held in an account ≤ that account's balance. When an expense
would break it, the API returns a warning (not an error) so the UI can ask which goal to draw from.

### 2.2 Behaviour

- **Pay yourself first (B1, W5).** When an `income` transaction is created, in the same DB
  transaction create `auto` contributions for every goal with `percent_of_income`, in
  `priority` order, capped at each goal's remaining target. The API response includes the
  split; the UI shows *"Set aside ৳4,500: Emergency ৳3,000 · Laptop ৳1,500 — Undo"*.
  Editing or deleting the income re-computes its linked `auto` contributions.
- **Emergency goal (W1, W4).** Seeded for every user. Target is computed, not typed:
  `target_months × average essential monthly expense (trailing 6 months)`, with
  `target_months` defaulting to 3 (stable) or 6 (variable), editable within 3–12.
  Shows a **1-month milestone** first (starter buffer), then the full target.
- **Sinking funds (W6).** `kind sinking` + `target_date` → required monthly amount
  `ceil((target − balance) / months_left)`. With `repeats_yearly`, after the spend the
  goal resets to the next date. When the user records an expense in a linked category the form
  offers *"Pay from sinking fund?"*, which records a withdrawal.
- **Withdrawals have friction (B5).** Require a reason from a short list (Emergency,
  Planned purchase, Rebalancing, Other + text). Emergency-goal withdrawals show the
  months-of-cover before/after.
- **Progress maths:** `required_monthly`, `projected_completion_date` from the trailing
  3-month contribution pace, status `on_track | behind | ahead | done`.
- **Available to spend** = liquid balances − goal balances in liquid accounts. It becomes the
  hero number on the dashboard instead of the raw balance, and the low-balance warning uses it.

### 2.3 Migration from `savings_sectors`

1. For each sector create a goal (`kind` from name: Emergency → `emergency`, else `custom`;
   `funding_rule manual`; keep colour/icon/target).
2. Create an `opening` contribution equal to today's computed `allocatedCents` so no number
   jumps for the user.
3. Show a one-time card: *"Your sectors are now goals. Choose how each one is funded."*
4. Drop `savings_sectors` and the `/account/sectors` endpoints one release later.

### 2.4 UI

- New nav item **Goals** (or a tab inside **Plan**, see Phase 3). Goal cards: balance,
  target, required per month, status, next milestone.
- Emergency card shows **months of cover** as the primary number.
- Quick actions: *Add money* (one tap, B5) and *Withdraw* (with reason).

**Principles served:** W1, W4, W5, W6, B1, B5, B6.

---

## Phase 3 — Spending plan: budgets & rule templates

> **Done.** Migration `0008_phase3_spending_plan`; the nav item is now **Plan** (`/budgets`).
> Simplifications: budgets are deleted outright (a plan is not a record, and soft-deleted rows
> would collide with the unique month/category key); there is no separate per-user method
> preference — a new month inherits the latest plan's method (50/30/20 for a first plan);
> suggestions come with the plan response instead of a separate `/suggest` endpoint, and
> `PUT /budgets/bulk` applies them, edits and reallocations in one call.

*Review items #3 and #7.* The backend `budgets` module exists; this phase adds the UI and
planning logic.

### 3.1 Schema

```text
budgets (changes)
  + rollover          boolean default false
  + deleted_at        timestamptz null

monthly_plans
  id, user_id, year, month
  expected_income_cents bigint
  method              enum('zero_based','category_caps','fifty_thirty_twenty','seventy_twenty_ten')
  notes               text null
  unique (user_id, year, month)
```

Default method is a per-user preference (`users.budget_method`), copied into each month's plan.

### 3.2 Backend endpoints (add to `BudgetsController`)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/budgets/plan?year&month` | Plan + budgets + actuals + goal contributions, **one request** |
| `PUT` | `/budgets/plan` | Upsert expected income / method |
| `POST` | `/budgets/copy` | Copy last month's budgets and plan |
| `GET` | `/budgets/suggest?year&month` | Suggested caps = trailing 3-month median per category |
| `DELETE` | `/budgets/:id` | Soft delete |

**Rollover:** `available = amount + carry`, where `carry = prev.available − prev.spent` when
`rollover` is on. Overspend carries as negative so it is corrected rather than hidden.

### 3.3 Plan screen — top-down order is the principle

The screen is ordered by the waterfall so saving happens *before* spending:

```text
Expected income                               ৳ 80,000
① Pay yourself first  (goals, investing, extra debt)   − 16,000   (20%)
② Needs               (essential categories)           − 40,000   (50%)
③ Wants               (other categories)               − 24,000   (30%)
─────────────────────────────────────────────────────────────
Left to assign                                 ৳ 0      ✓ zero-based
```

- **Zero-based:** "Left to assign" must reach 0; the page nudges but never blocks.
- **50/30/20:** needs ≤ 50%, wants ≤ 30%, savings + extra debt ≥ 20%; the bars show target vs plan vs actual.
- **70/20/10:** living ≤ 70, savings ≥ 20, debt/giving 10.
- **Category caps:** today's behaviour, just caps.
- Budget rows show spent / available with neutral colours until 100%; alerts at 80% and 100%
  (B7: copy says *"Move money from another category?"* with a one-tap reallocation).
- Empty state: *Copy last month* or *Start from my 3-month average*.

**Principles served:** W5 (savings first), B1, B6, B7.

---

## Phase 4 — Recurring transactions & automation

> **Done.** Migration `0009_phase4_recurring`. Differences from the sketch below: no
> `interval`/`day_of_month` columns (the anchor date sets the day, clamped to short months;
> "biweekly" covers 2-week cycles); an added `period_offset_months` (−1…+1) so rent paid on
> the 1st counts toward the previous month; due rules are posted lazily from the dashboard,
> ledger and recurring endpoints (throttled to once per 5 minutes per user, reset when a rule
> changes); past occurrences are never back-filled; "upcoming" runs to the same date next month
> so monthly items always appear. Shape validation now lives in a shared `LedgerValidator`.

*Review item #4.*

### 4.1 Schema

```text
recurring_rules
  id, user_id
  type, amount_cents, account_id, counter_account_id, category_id, note   # template
  frequency       enum('weekly','biweekly','monthly','quarterly','yearly')
  interval        int default 1
  anchor_date     date                  # first occurrence
  day_of_month    int null              # clamp to month length (31 → 30/28)
  end_date        date null
  next_due_date   date
  auto_post       boolean default false
  is_subscription boolean default false
  paused_at       timestamptz null
  created_at, updated_at

transactions: unique (recurring_rule_id, occurrence_date) WHERE recurring_rule_id IS NOT NULL
```

### 4.2 Engine

- **Lazy materialisation**, because the Render free tier sleeps and cron is unreliable:
  on `GET /dashboard/overview` and on login, post every due occurrence of
  `auto_post` rules up to "today" in the **user's timezone** (`users.timezone`).
  The unique index makes this idempotent under concurrent requests (`ON CONFLICT DO NOTHING`).
- Rules with `auto_post = false` appear in **Due** for confirm, edit or skip.
- A posted salary is an ordinary income → it triggers goal auto-contributions (Phase 2).
  **This is payday automation (B1).**
- Recurring transfers to investment accounts (W5) and debt payments (W3) are first-class
  templates in the "New rule" picker: *"Invest every payday"*, *"Pay loan monthly"*.

### 4.3 UI

- **Upcoming** widget on the dashboard (next 30 days): bills, income, transfers.
- `/transactions?tab=recurring` to manage rules; "Make recurring" on any transaction.
- Subscription total per month and per year (*"৳1,200/mo = ৳14,400/yr"*): framing the annual
  cost is a proven way to prompt cancellation.

**Principles served:** B1, W3, W5, W6.

---

## Phase 5 — Insights

*Review items #5, #6, #8, #9 plus the Next Best Action engine.* New `InsightsModule`
(`backend/src/modules/insights/`) with pure calculators in `insights/calc/*.ts`.

### 5.1 Net worth (#9, B4)

```text
account_valuations
  id, account_id, user_id, date, value_cents, note
  unique (account_id, date)
```

- Net worth at the end of month *m* = Σ asset balances − Σ liability balances at *m*;
  for `investment`/`retirement`/`property` use the latest valuation ≤ *m* when present,
  else the book balance.
- `GET /insights/net-worth?months=24` → monthly series computed with one query using
  `generate_series` of month-ends joined to cumulative sums; cache per user in
  `UserCacheService` and invalidate on writes.
- Dashboard hero row: **Net worth · Available to spend · Savings rate**.
- Monthly prompt on investment accounts: *"Update the value of Brokerage (last: 34 days ago)."*

### 5.2 Runway — "months of freedom" (#6)

```text
runway_full       = liquid assets / avg monthly expense (trailing 6 mo)
runway_essential  = liquid assets / avg monthly essential expense (trailing 6 mo)
```

Shown as two numbers: *"4.2 months at your current lifestyle, 7.1 months on essentials."*

### 5.3 Financial health score (#5)

Each metric is scored 0–100 by piecewise-linear interpolation between a "poor" and a
"healthy" anchor, then weighted. Requires ≥ 3 months of data; otherwise the metric shows
"Not enough data" and is excluded (weights re-normalised).

| Metric | Definition | Poor → Healthy | Weight |
|---|---|---|---|
| Savings rate | (income − expense) / income, trailing 3 mo | 0% → 20% | 20 |
| Investing rate | transfers to investment/retirement / income, trailing 3 mo | 0% → 15% | 10 |
| Emergency cover | emergency goal balance / avg essential expense | 0 → target months (3–12) | 20 |
| Debt service | (debt transfers + debt interest) / income | 50% → 15% | 15 |
| High-interest debt | Σ balances with APR ≥ 8% | any → none (binary) | 10 |
| Housing cost | housing-tagged expense / income | 50% → 30% | 5 |
| Fixed costs | fixed-category expense / income | 80% → 50% | 5 |
| Net worth trend | 6-month slope of net worth | negative → positive | 10 |
| Protection | health insurance; life insurance if dependents > 0 | missing → covered | 5 |

- **Income basis:** the app records take-home (net) income, whereas the classic ratios use
  gross income. Using net makes every threshold **more conservative**; state this in the UI.
- Output: total score, band (`Building` < 40, `Stable` 40–69, `Strong` 70–84, `Thriving` ≥ 85),
  and per-metric value, target, score, and a one-line "how to improve".
- Never show the score without the breakdown (C: explainable).

### 5.4 Next Best Action engine (B6)

A pure function `nextBestAction(snapshot) → Action` that walks the waterfall and
returns the **first** unmet step, so the user sees one focus at a time:

```text
1. available_to_spend < 0                         → "Cover the overspend"
2. emergency cover < 1 month essentials           → "Build your 1-month starter buffer"   (W1)
3. employer_match > 0 and not captured            → "Capture your full employer match"   (W2)
4. any debt APR ≥ 8%                              → "Pay extra on <highest-APR debt>"    (W3)
5. emergency cover < target months               → "Finish your emergency fund"         (W4)
6. investing rate < 15%                           → "Raise investing to 15% of income"   (W5)
7. sinking fund behind for costs in next 12 mo    → "Top up <fund>"                      (W6)
8. protection gaps                                → "Review health/life cover"           (W7)
9. otherwise                                      → "You're on track — review allocation" (W10)
```

Each action includes a concrete amount (e.g. *"৳6,000/month for 5 months"*) and a deep
link that pre-fills the form (a new goal, a recurring transfer, the debt planner).

### 5.5 Spending insights (#8)

Computed on request in SQL; results limited to the top 3 to avoid noise:

- **Category drift:** this month vs trailing 3-month average; flag when > +25% **and**
  > 5% of monthly income.
- **Unusual transaction:** amount > median + 3 × MAD for its category (≥ 6 samples).
- **Subscription finder:** ≥ 3 expenses with same category, amount within ±5%,
  and 25–35 day spacing, not already a recurring rule → *"Looks like a subscription. Track it?"*
- **Lifestyle creep (W9):** trailing-3-month income vs prior 3 months up > 5%, and
  Δexpense / Δincome > 50% → *"You're spending more than half of your raise."*

### 5.6 Dashboard changes

`getDashboardOverview` gains `netWorth`, `availableToSpend`, `runway`, `health` (score only),
`nextAction`, `insights[]`, `upcoming[]` — still **one request**, independent queries in
`Promise.all`. The full health breakdown lives on a new **Insights** page.

**Principles served:** W1–W10 (via NBA), B4, B6, B7.

---

## Phase 6 — Wealth building

*Review items #10, #11, #12, #15.* Pure calculators live in `frontend/src/lib/finance/`
(interactive sliders need instant recomputation) and are mirrored in the backend
only where the dashboard needs them.

### 6.1 Debt payoff planner (#10, W3)

- Inputs: liability accounts (balance, APR, minimum payment) + extra monthly amount.
- Monthly simulation until all balances hit 0 (cap 600 months):
  `interest = balance × APR / 12`; pay minimums on all; put the extra (plus freed-up minimums)
  on the target debt by strategy.
- Strategies: **Avalanche** (highest APR first, default, saves the most interest),
  **Snowball** (smallest balance first, better for motivation), **Current** (minimums only).
- Output per strategy: payoff date, total interest, interest saved vs minimums, month-by-month
  schedule per debt. Detect negative amortisation (payment ≤ interest) and warn.
- "Apply this plan" → creates recurring transfers (Phase 4) and a `debt_payoff` goal.

### 6.2 Financial independence calculator (#11)

```text
FI number        = annual expenses / SWR               # SWR 4% default; 3–3.5% for early retirement
years to FI      = n such that FV(invested, contrib, r_real, n) ≥ FI number
FV               = P(1+r)^n + C·((1+r)^n − 1)/r        # monthly compounding, real return
coast FI         = FI number / (1+r)^(years to retirement age)
```

- Defaults from `financial_profile` (SWR, expected real return); use **real**
  (inflation-adjusted) returns so results are in today's money.
- Sensitivity table: returns 3/5/7% × savings rate 10/20/30/50%. Showing the savings-rate
  row is the point: it matters more than the return assumption.
- **Passive income coverage** = passive + portfolio income / expenses. It's a live FI progress bar.
- Disclaimer: projections are assumptions, not guarantees.

### 6.3 Investment tracking (#12, W5, W10)

MVP without market-price APIs (privacy, cost, reliability):

- Investment accounts carry `asset_class` and `expense_ratio_bps`; values come from
  `account_valuations`.
- **Return** per account and total: simple Modified Dietz over the period
  (valuation change − net contributions) / (start value + weighted contributions).
- **Allocation:** current % by asset class vs the user's **target allocation**
  (`target_allocations(user_id, asset_class, percent)`). Drift > 5 percentage points → a
  rebalancing prompt, at most yearly unless drift > 10 pp (W10).
- **Fee drag:** Σ value × expense ratio per year, and 20-year cost at the expected return
  (*"This 1.5% fee costs ~৳X over 20 years vs a 0.2% fund"*) — educational, no product names.
- **Contribution consistency:** months with an investment transfer in the last 12 (dollar-cost averaging).

### 6.4 Income tracking (#15, W8)

- `categories.income_kind` (Phase 0) powers: income by kind, number of active sources
  (categories with income in ≥ 3 of the last 6 months), largest source share
  (concentration risk if > 80%), passive coverage (6.2).
- Income growth: year-over-year trailing-12-month income; paired with the creep detector (5.5).

**Principles served:** W3, W5, W8, W10.

---

## Phase 7 — Habits

*Review item #14 plus behavioural rules B2, B3, W9.*

### 7.1 Monthly review ritual (#14, W10)

```text
monthly_reviews
  id, user_id, year, month
  completed_at
  wins        jsonb      # generated
  leaks       jsonb      # generated
  worth_it    jsonb      # {categoryId: 'yes'|'no'|'meh'}  (B3)
  action      text       # the one commitment
  action_done boolean null   # asked next month
  unique (user_id, year, month)
```

- Triggered on the first visit after a month closes (dismissible, re-openable from Insights).
- Four short steps:
  1. **Numbers:** income, spending, savings rate vs target, net worth change, health score change.
  2. **3 wins:** categories under budget, goal milestones, debt paid, net worth up.
  3. **3 leaks:** biggest overspends, category drift, new subscriptions, creep warning.
  4. **Worth it?** For the top 5 discretionary categories: 👍 / 😐 / 👎. Repeated 👎 feeds a
     suggestion to lower that budget next month (B3: spend on what you value).
- Pick **one** action for next month (from the NBA or a leak); next review asks if it was done.

### 7.2 Cooling-off list (B2)

```text
wishlist_items
  id, user_id, name, amount_cents, url null, category_id null
  created_at, cool_until (created_at + 48h, configurable 24h–30d)
  decision   enum('pending','bought','skipped')  decided_at
```

- Setting: "Apply the cooling-off rule to non-essential purchases above ৳X".
- When a user records a non-essential expense above the threshold, the form offers
  *"Add to your cooling-off list instead?"*.
- After the timer: *"Still want it?"* → **Buy** (pre-fills the transaction) or **Skip**.
- Skipped totals are celebrated: *"You skipped ৳18,500 of impulse buys this year"*, with an
  optional one-tap transfer of that amount to a goal.

**Principles served:** B2, B3, B7, W9, W10.

---

## Cross-cutting concerns

### Navigation (final state)

`Overview · Accounts · Transactions · Plan (Budgets | Goals) · Insights (Health | Net worth | Debt | FI | Investments) · Reports · Settings`

### Testing — currently no unit tests exist; add them first

- **Backend (Jest):** unit tests for every calculator in `insights/calc/`, goal
  auto-contribution splitting, rollover, recurring date generation (month-end clamping, DST,
  user timezone), account balance sign rules by `nature`. Property test: a transfer never
  changes total net worth or savings rate.
- **Frontend (add Vitest):** `lib/finance/*` debt simulator, FI maths, formatters.
- **E2E (`backend/test`):** migration of a seeded pre-Phase-1 database; income → auto
  contributions → dashboard numbers.
- Golden fixtures: a "typical month" dataset with hand-computed expected results.

### Data integrity

- All multi-row writes (income + auto contributions, transfers, recurring posting) run in a
  single DB transaction.
- Soft-deleting a transaction soft-deletes its linked `auto` contributions.
- CHECK constraints over app-only validation wherever possible.

### Performance

- Keep one request per screen: extend `getDashboardOverview`; add `getPlanOverview`
  and `getInsightsOverview` in the same style.
- New indexes: `transactions(user_id, account_id, date)`, `transactions(user_id, counter_account_id)`,
  `goal_contributions(goal_id)`, `recurring_rules(user_id, next_due_date)`.
- Cache heavy series (net worth, health) in `UserCacheService`, invalidated on any financial write.

### Compliance & copy

- Footer on Insights: *"Educational guidance based on widely used personal-finance rules.
  Not individual investment, tax or legal advice."*
- Never name specific funds, stocks or providers.
- Use neutral language (B7): "rebalance", "move money", "on track / behind" — no red failure states
  for normal overspending.

### Documentation

Update `README.md` (features), `ARCHITECTURE.md` (new modules, ledger identities),
`WIKI.md` (user guide for goals, transfers, health score), and Swagger descriptions for
every new endpoint.

---

## Sequencing & sizing

S ≈ 1–3 days · M ≈ 1 week · L ≈ 2 weeks (one developer).

| Phase | Items | Size | Depends on | Ships value on its own? |
|---|---|---|---|---|
| 0 Foundations | bigint, currency, category flags, financial profile, test setup | M | — | Yes (currency) |
| 1 Accounts & transfers | #1 | L | 0 | Yes — correct savings rate |
| 2 Goals & sinking funds | #2, #13 | L | 1 | Yes — pay-yourself-first |
| 3 Plan & templates | #3, #7 | M | 0, 2 | Yes |
| 4 Recurring | #4 | M | 1 (2 for automation) | Yes |
| 5 Insights | #5, #6, #8, #9, NBA | L | 1, 2 (3 improves it) | Yes — the "coach" moment |
| 6 Wealth | #10, #11, #12, #15 | L | 1, 5 | Yes |
| 7 Habits | #14, cooling-off | M | 3, 5 | Yes |

**Suggested release train:** `0 → 1 → 2 → 4 → 3 → 5 → 6 → 7`. Recurring (4) moves ahead of
the plan screen (3) because payday automation (B1) has the bigger behavioural impact, and
the plan screen then gets accurate "expected income" from recurring salary rules.

---

## Appendix — formulas & thresholds

| Name | Formula | Default / target |
|---|---|---|
| Savings rate | (income − expense) / income | ≥ 20% (≥ 50% for early FI) |
| Investing rate | invest transfers / income | ≥ 15% |
| Emergency target | target months × avg essential expense (6 mo) | 3–6 mo stable, 6–12 variable |
| Starter buffer | 1 × avg monthly expense | milestone before debt payoff |
| High-interest debt | APR ≥ 8% | pay off before investing beyond match |
| Housing ratio | housing expense / income | ≤ 30% |
| Debt service ratio | debt payments / income | ≤ 36% total, ≤ 15% consumer |
| Fixed-cost ratio | fixed expense / income | ≤ 50–60% |
| Runway | liquid assets / avg monthly expense | ≥ emergency target |
| FI number | annual expense / SWR | SWR 4% (3–3.5% early FI) |
| Required monthly (goal) | (target − balance) / months left | — |
| Rebalance trigger | drift > 5 pp (yearly), > 10 pp (any time) | — |
| Lifestyle creep | Δexpense / Δincome | ≤ 50% |
| Income volatility | stdev / mean of monthly income (6 mo) | > 0.25 → "variable" |
| Unusual transaction | > median + 3 × MAD (category) | ≥ 6 samples |
| Subscription | ≥ 3 × same amount ±5%, 25–35 day gaps | — |
