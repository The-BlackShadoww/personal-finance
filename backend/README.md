# Finance App — Backend API

NestJS REST API for the personal finance application. Handles authentication, user data, transactions, categories, budgets, goals, recurring rules, insights, wealth tools, monthly reviews, and report generation. The API is versioned under `/api/v1` and uses PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/).

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 20+ |
| Framework | [NestJS](https://nestjs.com/) 11 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Validation | `class-validator` + `class-transformer` |
| Config | `@nestjs/config` with Joi validation |
| Security | Helmet, CORS, bcrypt, JWT, httpOnly refresh cookies |
| Reports | `@react-pdf/renderer` (PDF), `fast-csv` (CSV) |
| Rate limiting | `@nestjs/throttler` (in-memory or Redis) |

Optional infrastructure: Redis (rate limiting and caching), Google OAuth.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **PostgreSQL** — use [Docker Compose](../docker-compose.yml) at the repo root, or your own instance

## Quick start

### 1. Start PostgreSQL (and Redis)

From the **repository root**:

```bash
docker compose up -d postgres
```

Redis is optional; start it when you need consistent rate limiting or caching:

```bash
docker compose up -d redis
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` if your database URL or secrets differ from the defaults.

### 3. Install dependencies and run migrations

```bash
npm install
npm run db:migrate
```

`db:migrate` applies SQL files in `drizzle/migrations/` via Drizzle Kit. Ensure `DATABASE_URL` in `.env` points at the database you started (default: `financeapp_dev` on `localhost:5432`).

### 4. Start the API

```bash
npm run start:dev
```

The server listens on the port from `PORT` (default **3001**). Base URL: `http://localhost:3001/api/v1`.

Interactive Swagger docs (development): `http://localhost:3001/api/docs`

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing access tokens |
| `REFRESH_TOKEN_SECRET` | Yes | Secret for refresh tokens |
| `TWO_FACTOR_ENCRYPTION_KEY` | Yes | 64-character hex string for AES-256-GCM TOTP secret encryption |
| `FRONTEND_URL` | Yes | Allowed CORS origin (e.g. `http://localhost:3000`) |
| `BACKEND_URL` | Yes | This service's public URL (used in OAuth callbacks) |
| `PORT` | No | HTTP port (default `3001`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `REDIS_URL` | No | Redis URL for distributed rate limiting |
| `ENABLE_SWAGGER` | No | Set `true` to expose Swagger in production |

See [.env.example](./.env.example) for a full template. **Do not commit `.env`** — it contains secrets.

## API conventions

### Base path

All routes are prefixed with `/api/v1`.

### Successful responses

Successful JSON responses are wrapped by a global interceptor:

```json
{
  "data": { },
  "meta": {
    "timestamp": "2026-10-09T12:00:00.000Z"
  }
}
```

File download endpoints (`/reports/csv`, `/reports/pdf`) write directly to the response stream and are not wrapped.

### Error responses

Errors return a consistent shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "requestId": "uuid-or-client-provided-id",
  "timestamp": "2026-10-09T12:00:00.000Z"
}
```

You may send `X-Request-Id` on requests; otherwise the server generates one and echoes it on the response.

### Validation

Request bodies are validated with `ValidationPipe` (whitelist + transform). Unknown properties are stripped.

## Modules

| Module | Controller prefix | Responsibility |
| --- | --- | --- |
| `AuthModule` | `/auth` | Register, login, refresh, logout, Google OAuth, 2FA (TOTP) |
| `UsersModule` | `/users` | Profile updates, password changes |
| `AccountsModule` | `/accounts` | Multi-account CRUD, balances, six-month trend, archive/restore/delete, valuations |
| `GoalsModule` | `/goals` | Goal CRUD, contributions, withdrawals, income allocation, reorder, archive |
| `RecurringModule` | `/recurring` | Recurring rules, auto-post/confirm/skip, pause/resume |
| `CategoriesModule` | `/categories` | Category CRUD, default seeding |
| `TransactionsModule` | `/transactions` | Ledger CRUD (income/expense/transfer), filters, projected balance |
| `BudgetsModule` | `/budgets` | Spending plan, per-category budgets, bulk upsert, copy-previous-month |
| `InsightsModule` | `/insights` | Health score, next best action, runway, net worth, spending insights |
| `WealthModule` | `/wealth` | Debt payoff, FI calculator, investment tracking, income tracking |
| `ReviewsModule` | `/reviews` | Monthly review status, review data, complete/save |
| `WishlistModule` | `/wishlist` | Cooling-off list (add, decide, remove) |
| `FinancialProfileModule` | `/profile/financial` | User financial profile (income stability, dependents, insurance, etc.) |
| `CalculationsModule` | `/calculations` | Monthly/quarterly/yearly/range aggregates, category breakdown, dashboard overview |
| `ReportsModule` | `/reports` | CSV and PDF generation |
| `AccountModule` | `/account` | Legacy account-config and savings sectors |
| `HealthModule` | `/health` | Liveness check |

## Database

### Schema

Drizzle schema lives in [`src/db/schema/index.ts`](./src/db/schema/index.ts). Core tables:

- **users** — accounts (email/password, optional Google ID, 2FA fields, timezone)
- **categories** — income/expense categories per user, with kind metadata
- **transactions** — amounts in cents, type (income/expense/transfer), accountId, counterAccountId
- **accounts** — multi-account registry with kind, balance, archivedAt
- **account_valuations** — dated market values for investment/retirement/property accounts
- **goals** — named money earmarks inside accounts
- **goal_allocations** — links income transactions to goal contributions
- **recurring_rules** — schedule definitions with frequency, amount, auto-post flag
- **recurring_occurrences** — posted or skipped rule instances
- **financial_profiles** — per-user profile answers for tailored advice
- **monthly_reviews** — completed review answers per month
- **wishlist_items** — cooling-off list entries
- **budgets** — monthly limits per user/category with method and expected income
- **refresh_tokens** — hashed refresh tokens for auth sessions
- **account_config** — legacy: opening balance and low-balance threshold
- **savings_sectors** — legacy: named allocation buckets

### Scripts

| Command | Description |
| --- | --- |
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly to the DB (dev only; skips migration files) |
| `npm run db:studio` | Open Drizzle Studio in the browser |

After changing `src/db/schema`, run `db:generate`, review the SQL under `drizzle/migrations/`, then `db:migrate`.

## Project structure

```
backend/
├── drizzle/
│   └── migrations/           # Generated SQL migrations
├── src/
│   ├── common/
│   │   ├── cache/            # UserCacheModule (hot account lookups)
│   │   ├── decorators/       # @CurrentUser, @Public
│   │   ├── filters/          # GlobalExceptionFilter, ThrottlerExceptionFilter
│   │   ├── guards/           # JwtAuthGuard
│   │   ├── interceptors/     # LoggingInterceptor, TransformInterceptor
│   │   ├── middleware/       # RequestIdMiddleware
│   │   ├── swagger/          # Shared Swagger response types
│   │   ├── throttler/        # ThrottlerStorageRedisService
│   │   └── types/            # AuthenticatedUser interface
│   ├── config/               # Typed configuration factory (Joi schema)
│   ├── db/                   # DrizzleModule, schema, DB_TOKEN
│   ├── modules/
│   │   ├── account/          # Legacy account-config + savings sectors
│   │   ├── accounts/         # Multi-account CRUD + valuations
│   │   ├── auth/             # JWT, Google OAuth, TOTP 2FA, strategies
│   │   ├── budgets/          # Spending plan, budgets, PlanService
│   │   ├── calculations/     # Aggregation engine + dashboard overview
│   │   ├── categories/       # Category CRUD + default seeders
│   │   ├── financial-profile/# User financial profile
│   │   ├── goals/            # Goal CRUD, contributions, allocations
│   │   ├── health/           # /health liveness
│   │   ├── insights/         # Health score, next action, runway, net worth
│   │   ├── ledger/           # LedgerValidator (shared by transactions + recurring)
│   │   ├── recurring/        # Recurring rules + materialization engine
│   │   ├── reports/          # CSV + PDF generation
│   │   ├── reviews/          # Monthly review
│   │   ├── transactions/     # Ledger CRUD (income/expense/transfer)
│   │   ├── users/            # Profile + password
│   │   ├── wealth/           # Debt, FI, investments, income
│   │   └── wishlist/         # Cooling-off list
│   ├── app.module.ts
│   └── main.ts               # Bootstrap: helmet, CORS, pipes, interceptors, Swagger
├── test/                     # E2E tests
├── .env.example
└── drizzle.config.ts
```

### Cross-cutting behavior

- **RequestIdMiddleware** — assigns or forwards `X-Request-Id` on every request
- **LoggingInterceptor** — logs method, URL, and response time
- **TransformInterceptor** — wraps successful payloads in `{ data, meta }`
- **GlobalExceptionFilter** — normalizes HTTP and unexpected errors
- **JwtAuthGuard** (global) — validates bearer tokens; `@Public()` opts out
- **ThrottlerGuard** (global) — rate limits by user ID or IP

Inject the database with the `DB_TOKEN` provider from `DbModule` (global).

## npm scripts

| Script | Description |
| --- | --- |
| `npm run start` | Start once (no watch) |
| `npm run start:dev` | Start with file watch |
| `npm run start:debug` | Start with debugger and watch |
| `npm run start:prod` | Run compiled `dist/main.js` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier on `src/` and `test/` |
| `npm run test` | Unit tests (Jest) |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Coverage report |

## Testing

```bash
# unit (calc modules have spec files in their calc/ subdirectories)
npm run test

# e2e (requires DB/env)
npm run test:e2e
```

## Production notes

1. Set strong, unique values for `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `TWO_FACTOR_ENCRYPTION_KEY`.
2. Point `DATABASE_URL` at your production PostgreSQL instance.
3. Set `FRONTEND_URL` to your deployed frontend origin (CORS).
4. Set `BACKEND_URL` to this service's public URL.
5. Build and run:

   ```bash
   npm run build
   npm run start:prod
   ```

6. Run migrations as part of deploy: `npm run db:migrate`.

Helmet is enabled globally. CORS allows credentials from `FRONTEND_URL` only.

## Related

- **Frontend** — sibling app at [`../frontend`](../frontend) (default dev URL `http://localhost:3000`)
- **Docker** — [`../docker-compose.yml`](../docker-compose.yml) for local Postgres and Redis
- **Architecture** — [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for full system design

## License

Private — UNLICENSED (see [package.json](./package.json)).
